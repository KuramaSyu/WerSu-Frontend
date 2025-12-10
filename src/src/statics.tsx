declare global {
  interface ImportMetaEnv {
    readonly VITE_BACKEND_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL ?? '';
export const M1 = '0.25rem';
export const M2 = '0.5rem';
export const M3 = '1rem';
export const M4 = '2rem';
export const M5 = '4rem';
export const M6 = '8rem';
export const M7 = '12rem';
export const M8 = '16rem';