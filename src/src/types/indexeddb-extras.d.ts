// IDB runtime members missing from lib.dom.d.ts. Read by imageBlobCache.
interface IDBDatabase {
  readyState: "pending" | "open" | "closing" | "closed";
}

interface IDBTransaction {
  readonly oldVersion?: number;
  addEventListener(
    type: "blocked",
    listener: (event: IDBVersionChangeEvent) => void,
  ): void;
  removeEventListener(
    type: "blocked",
    listener: (event: IDBVersionChangeEvent) => void,
  ): void;
  onblocked: ((event: IDBVersionChangeEvent) => void) | null;
}