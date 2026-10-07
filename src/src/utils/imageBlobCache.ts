// IndexedDB-backed image blob cache, keyed by source URL.
// Schema: db wersu-image-blob-cache v2, store blobs, value { v, blob, contentType, fetchedAt }.
// Every entry carries its schema v; a hydrate that sees a different v drops it.

import { bgLog, bgLogError, bgLogWarn } from "./bgDebug";

const DB_NAME = "wersu-image-blob-cache";
const DB_VERSION = 2;
const STORE_NAME = "blobs";

// Bump this whenever the on-disk shape of a CachedBlob changes.
export const CACHE_ENTRY_VERSION = 1;

interface CachedBlob {
  v: number;
  blob: Blob;
  contentType: string;
  fetchedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

// How long to wait for `indexedDB.open` to settle before giving up.
// Without this, a stuck upgrade (e.g. another tab holds v1) wedges
// the whole cache silently and breaks every `get` / `put`.
const OPEN_TIMEOUT_MS = 3000;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise === null) {
    bgLog(`openDb: opening ${DB_NAME} v${DB_VERSION}`);
    const openStartedAt = Date.now();
    let settled = false;
    const finishResolve = (db: IDBDatabase, reason: string) => {
      if (settled) return;
      settled = true;
      bgLog(
        `openDb: settled via ${reason} in ${String(Date.now() - openStartedAt)} ms readyState=${String(db.readyState)}`,
      );
    };
    const finishReject = (err: unknown, reason: string) => {
      if (settled) return;
      settled = true;
      bgLog(
        `openDb: rejected via ${reason} in ${String(Date.now() - openStartedAt)} ms err=${String(err)}`,
      );
      // Clear the cached promise so the next call gets a fresh shot.
      dbPromise = null;
    };
    const dbPromiseInner = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB is not available"));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      bgLog(`openDb: req created readyState=${String(req.readyState)}`);
      req.onupgradeneeded = () => {
        bgLog(
          `openDb: onupgradeneeded oldVersion=${String(req.transaction?.oldVersion)}`,
        );
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => {
        finishResolve(req.result, "onsuccess");
        resolve(req.result);
      };
      req.onerror = () => {
        const err = req.error ?? new Error("IDB open failed");
        finishReject(err, "onerror");
        reject(err);
      };
      req.onblocked = () => {
        bgLog(
          "openDb: onblocked (another connection holds the previous version)",
        );
        // Don't reject here -- the blocked open can still succeed once
        // the other tab closes. The OPEN_TIMEOUT_MS below is the real
        // safety net.
      };
    });
    // Wrap the inner promise so we can attach a hard timeout. The
    // timer rejects with a synthetic error; the resulting promise is
    // what `runTx` and `getCachedBlob` actually await.
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        const err = new Error(
          `IDB open timed out after ${String(OPEN_TIMEOUT_MS)} ms`,
        );
        finishReject(err, "timeout");
        reject(err);
      }, OPEN_TIMEOUT_MS);
      dbPromiseInner.then(
        (db) => {
          clearTimeout(timeoutHandle);
          resolve(db);
        },
        (err) => {
          clearTimeout(timeoutHandle);
          reject(err);
        },
      );
    });
    dbPromise.catch(() => {
      // Swallow here so the rejection isn't reported as an
      // unhandled rejection; the awaiter still sees it.
    });
  }
  return dbPromise;
}

// Callback can return IDBRequest or Promise; two-shape pattern dodges IDBRequest<T> contravariance.
type TxCallback<T> = (store: IDBObjectStore) => IDBRequest | Promise<T>;

function runTx<T>(mode: IDBTransactionMode, fn: TxCallback<T>): Promise<T> {
  bgLog(`runTx start mode=${mode}`);
  return openDb().then(
    (db) => {
      bgLog("runTx db ready, starting tx");
      return new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        let settled = false;
        const settle = (value: T) => {
          if (settled) return;
          settled = true;
          bgLog(`runTx settle value=${String(value)}`);
          resolve(value);
        };
        const fail = (err: unknown) => {
          if (settled) return;
          settled = true;
          bgLog(`runTx fail err=${String(err)}`);
          reject(err);
        };
        const req = fn(store);
        const reqDesc =
          req instanceof Promise
            ? `Promise<${String(req)}>`
            : `IDBRequest readyState=${String(req.readyState)} source=${String(req.source)}`;
        bgLog(`runTx req=${reqDesc}`);
        if (req instanceof Promise) {
          req.then(settle, fail);
        } else {
          req.onsuccess = () => {
            bgLog(`runTx req.onsuccess result=${String(req.result)}`);
            settle(req.result as T);
          };
          req.onerror = () => fail(req.error ?? new Error("IDB op failed"));
        }
        tx.oncomplete = () => {
          bgLog("runTx tx.oncomplete");
          if (!settled) settle(undefined as T);
        };
        tx.onerror = () => {
          bgLog(`runTx tx.onerror err=${String(tx.error)}`);
          fail(tx.error ?? new Error("IDB tx failed"));
        };
        tx.onabort = () => {
          bgLog(`runTx tx.onabort err=${String(tx.error)}`);
          fail(tx.error ?? new Error("IDB tx aborted"));
        };
        tx.onblocked = () => {
          bgLog("runTx tx.onblocked");
        };
      });
    },
    (err) => {
      bgLog(`runTx openDb rejected err=${String(err)}`);
      throw err;
    },
  );
}

// Drop rows whose v does not match the current schema.
function isCurrentVersion(value: unknown): value is CachedBlob {
  if (value === null || typeof value !== "object") return false;
  const v = (value as { v?: unknown }).v;
  if (v !== CACHE_ENTRY_VERSION) return false;
  const candidate = value as Partial<CachedBlob>;
  return (
    candidate.blob instanceof Blob &&
    typeof candidate.contentType === "string" &&
    typeof candidate.fetchedAt === "number"
  );
}

// Look up a cached blob. Returns null on miss, wrong-version, or unavailable IDB.
export async function getCachedBlob(url: string): Promise<CachedBlob | null> {
  if (!isCacheableUrl(url)) return null;
  try {
    const hit = await runTx<unknown>("readonly", (store) => store.get(url));
    if (!isCurrentVersion(hit)) {
      // Drop stale rows lazily so the next put starts clean.
      void runTx<unknown>("readwrite", (store) => store.delete(url));
      return null;
    }
    return hit;
  } catch {
    return null;
  }
}

// Store a blob. Throws on failure so callers can log.
export async function putCachedBlob(
  url: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  if (!isCacheableUrl(url)) return;
  const t0 = Date.now();
  bgLog(`IDB put start url=${url} size=${blob.size}`);
  const txPromise = runTx<unknown>("readwrite", (store) =>
    store.put(
      { v: CACHE_ENTRY_VERSION, blob, contentType, fetchedAt: Date.now() },
      url,
    ),
  );
  // Safety net: log if the write takes too long. The real await
  // happens below, so we never return before the transaction
  // actually settles -- otherwise a reload during the stuck window
  // would drop the row and hydrate would find nothing.
  const stuckTimer = new Promise<void>((resolve) => {
    setTimeout(() => {
      bgLogError(
        `IDB put STUCK after ${String(Date.now() - t0)} ms, url=${url}`,
      );
      resolve();
    }, 5000);
  });
  // Wait for whichever fires first, but do not return yet.
  await Promise.race([stuckTimer, txPromise]);
  try {
    await txPromise;
    bgLog(`IDB put done in ${String(Date.now() - t0)} ms`);
  } catch (err) {
    bgLogWarn(
      `IDB put failed in ${String(Date.now() - t0)} ms: ${String(err)}`,
    );
    throw err;
  }
}

// Drop a single URL from the cache.
export async function deleteCachedBlob(url: string): Promise<void> {
  if (!isCacheableUrl(url)) return;
  try {
    await runTx<unknown>("readwrite", (store) => store.delete(url));
  } catch {
    // ignore
  }
}

// Snapshot every cached entry. Filters out wrong-version rows.
export async function getAllCachedBlobs(): Promise<
  Array<[string, CachedBlob]>
> {
  try {
    const rows = await runTx<Array<[string, unknown]>>("readonly", (store) => {
      return new Promise<Array<[string, unknown]>>((resolve, reject) => {
        const out: Array<[string, unknown]> = [];
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor === null || cursor === undefined) {
            resolve(out);
            return;
          }
          out.push([String(cursor.key), cursor.value]);
          cursor.continue();
        };
        cursorReq.onerror = () =>
          reject(cursorReq.error ?? new Error("IDB cursor failed"));
      });
    });
    return rows.filter((entry): entry is [string, CachedBlob] =>
      isCurrentVersion(entry[1]),
    );
  } catch {
    return [];
  }
}

// http(s) URLs and our internal local: keys are cacheable. blob:/data:
// are already local and not worth the IDB round-trip; anything else is
// rejected to avoid persisting random strings.
function isCacheableUrl(url: string): boolean {
  return (
    url.startsWith("http:") ||
    url.startsWith("https:") ||
    url.startsWith("local:")
  );
}
