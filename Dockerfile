# ---------- Stage 1: build ----------
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

# ---------- Stage 2: serve ----------
FROM nginx:1.27-alpine AS runtime

# Drop privileges and use a stable port.
RUN sed -i 's|^user .*;|user nginx;|' /etc/nginx/nginx.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets produced by `vite build`.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:5173/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]