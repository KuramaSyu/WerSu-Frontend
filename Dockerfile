# Stage 1: build
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first for better layer caching.
COPY src/package.json src/package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy the rest of the source and build.
COPY src/ ./

# Vite reads these at build time. Override with --build-arg to retarget.
ARG VITE_BACKEND_URL=http://localhost:8080
ARG VITE_HOCUSPOCUS_WS_URL=ws://localhost:8666
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL} \
    VITE_HOCUSPOCUS_WS_URL=${VITE_HOCUSPOCUS_WS_URL}

RUN npm run build



# Stage 2: run
FROM caddy:2.11.9-alpine AS runtime

# Unprivileged runtime user. The official Caddy image ships none, and the
# config only binds :5173, so root is not needed.
RUN addgroup -S caddy && adduser -S -G caddy -h /data caddy

# Runtime config injection: writes `/env.js` from container env vars, then
# execs Caddy. Caddy has no `/docker-entrypoint.d/` hook, so this is an
# explicit entrypoint wrapper.
COPY --chmod=0755 docker/runtime-env.sh docker/caddy-entrypoint.sh /usr/local/bin/

COPY Caddyfile /etc/caddy/Caddyfile

# Static assets produced by `vite build`.
COPY --from=build /app/dist /srv

# Caddy persists autosaved config / storage here (`XDG_*` are the image's
# defaults); the unprivileged user must be able to write them.
RUN chown -R caddy:caddy /srv /data /config
USER caddy

EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:5173/ >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/usr/local/bin/caddy-entrypoint.sh"]