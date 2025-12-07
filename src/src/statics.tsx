declare global {
  interface ImportMetaEnv {
    readonly VITE_BACKEND_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL ?? '';
