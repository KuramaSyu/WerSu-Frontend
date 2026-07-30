#!/bin/sh
# Render `/env.js` from container env vars so the SPA picks up `BACKEND_BASE` / `HOCUSPOCUS_WS_URL` at start instead of baking them in; runs as the nginx image's `/docker-entrypoint.d/` hook. Emits only keys whose env var is set (`${VAR+x}`) so unset vars fall through to the build-time default; setting `VAR=""` still overrides it.
set -eu

OUT="/usr/share/nginx/html/env.js"

# Escape backslash and double quote so the value is safe inside a JS double-quoted string literal; URL env vars normally contain neither.
escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

{
  printf 'window.__ENV__ = {\n'
  sep=""
  if [ -n "${BACKEND_BASE+x}" ]; then
    printf '%s  BACKEND_BASE: "%s"\n' "$sep" "$(escape "$BACKEND_BASE")"
    sep=","
  fi
  if [ -n "${HOCUSPOCUS_WS_URL+x}" ]; then
    printf '%s  HOCUSPOCUS_WS_URL: "%s"\n' "$sep" "$(escape "$HOCUSPOCUS_WS_URL")"
    sep=","
  fi
  printf '};\n'
} > "$OUT"