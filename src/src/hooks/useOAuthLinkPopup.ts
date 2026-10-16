// Popup driver for the OAuth link flow used by Settings -> Security.
//
// The SPA opens a popup to ${BACKEND_BASE}/api/auth/link/{p}/init. The
// backend handles the OAuth dance, calls LinkCredential server-side,
// and 302s the popup to /complete?payload=... . The /complete HTML page
// base64url-decodes the JSON payload, posts it to window.opener, and
// closes itself. This hook waits for that message and resolves.

import { useCallback, useEffect, useRef, useState } from "react";
import { BACKEND_BASE } from "../statics";
import type { OAuthLinkPayload } from "../api/models/linkedProviders";

// The popup's /complete page is served by the backend, so `event.origin`
// is the backend's origin. BACKEND_BASE is a full URL like
// "https://api.example.com"; URL.origin gives the scheme + host + port.
function backendOrigin(): string {
  if (!BACKEND_BASE) return "";
  try {
    return new URL(BACKEND_BASE).origin;
  } catch {
    return "";
  }
}

// base64url -> UTF-8 string. Tolerates the standard base64 alphabet
// too; the only spec-level difference is `-_` vs `+/` plus optional
// padding, both of which we normalise.
function decodeBase64Url(value: string): string {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export interface UseOAuthLinkPopupResult {
  /**
   * Open the popup-based OAuth link flow. Resolves with the payload the
   * /complete page posted to window.opener. Rejects when:
   *   - the popup is blocked by the browser
   *   - the user closes the popup before completing
   *   - another link flow for the same provider is already running
   */
  start: () => Promise<OAuthLinkPayload>;
  /** Tear down the popup, listener, and poll interval (no-op if idle). */
  cancel: () => void;
  /** True between start() and either resolve or reject. */
  isLoading: boolean;
}

export function useOAuthLinkPopup(provider: string): UseOAuthLinkPopupResult {
  const [isLoading, setIsLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const listenerRef = useRef<((e: MessageEvent) => void) | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (listenerRef.current) {
      window.removeEventListener("message", listenerRef.current);
      listenerRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (popupRef.current && !popupRef.current.closed) {
      try {
        popupRef.current.close();
      } catch {
        // Popup already gone.
      }
    }
    popupRef.current = null;
    setIsLoading(false);
  }, []);

  // Close the popup if the SPA unmounts mid-flow.
  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback((): Promise<OAuthLinkPayload> => {
    if (popupRef.current) {
      return Promise.reject(new Error("Link flow is already in progress."));
    }
    if (!BACKEND_BASE) {
      return Promise.reject(
        new Error("Backend URL is not configured; cannot start the link flow."),
      );
    }
    setIsLoading(true);

    return new Promise<OAuthLinkPayload>((resolve, reject) => {
      const expectedOrigin = backendOrigin();
      const url = `${BACKEND_BASE}/api/auth/link/${encodeURIComponent(
        String(provider),
      )}/init`;

      const popup = window.open(
        url,
        "oauth-link",
        "popup,width=520,height=720",
      );
      if (!popup) {
        setIsLoading(false);
        reject(
          new Error(
            "Popup was blocked. Allow popups for this site and try again.",
          ),
        );
        return;
      }
      popupRef.current = popup;

      const handler = (event: MessageEvent) => {
        if (expectedOrigin && event.origin !== expectedOrigin) return;
        const raw = typeof event.data === "string" ? event.data : "";
        if (!raw) return;
        let parsed: OAuthLinkPayload;
        try {
          parsed = JSON.parse(decodeBase64Url(raw)) as OAuthLinkPayload;
        } catch {
          return; // unrelated message on the same origin
        }
        if (!parsed || parsed.provider !== provider || !parsed.id) return;
        cleanup();
        resolve(parsed);
      };
      window.addEventListener("message", handler);
      listenerRef.current = handler;

      const poll = setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(
            new Error(
              "Link cancelled - the popup was closed before completing.",
            ),
          );
        }
      }, 500);
      pollRef.current = poll;
    });
  }, [provider, cleanup]);

  return { start, cancel: cleanup, isLoading };
}
