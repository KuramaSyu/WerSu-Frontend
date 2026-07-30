// Overwritten at container start by `docker/20-runtime-env.sh`; empty in dev so `statics.tsx` falls through to the build-time `VITE_*` value.
window.__ENV__ = window.__ENV__ || {};