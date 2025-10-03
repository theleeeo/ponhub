#############################
# Frontend build (Next.js)
#############################
FROM node:20-bullseye AS web-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

#############################
# Backend build (Go)
#############################
FROM golang:1.24-bullseye AS api-build
WORKDIR /src

# Adjust paths if your Go app lives elsewhere
COPY go.mod go.sum ./
RUN go mod download
COPY main.go .
RUN CGO_ENABLED=0 go build -o /out/server

#############################
# Runtime (both processes)
#############################
FROM node:20-slim AS runtime
WORKDIR /app

# Install tini for correct signal handling and curl for healthcheck
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# --- Frontend runtime files ---
COPY --from=web-build /app/frontend/.next ./.next
COPY --from=web-build /app/frontend/package*.json ./
# Install only production deps (ensures `next` runtime is present)
RUN npm ci --omit=dev --no-audit --no-fund

# --- Backend binary ---
COPY --from=api-build /out/server /usr/local/bin/server

# --- Entrypoint script to run both processes ---
RUN <<'EOF' bash
set -euo pipefail
cat >/usr/local/bin/start.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail

# Defaults
: "${PORT:=3000}"       # Next.js port
: "${API_PORT:=8080}"   # Go API port

# Start Go API on API_PORT (override PORT for that process only)
PORT="$API_PORT" /usr/local/bin/server &
API_PID=$!

# Start Next.js production server
npm run start -- --port "$PORT" --hostname 0.0.0.0 &
WEB_PID=$!

term_handler() {
  echo "Shutting down..."
  kill -TERM "$WEB_PID" "$API_PID" 2>/dev/null || true
  wait "$WEB_PID" "$API_PID" 2>/dev/null || true
}
trap term_handler TERM INT

# If either exits, stop the other
wait -n "$WEB_PID" "$API_PID"
kill -TERM "$WEB_PID" "$API_PID" 2>/dev/null || true
wait || true
SH
chmod +x /usr/local/bin/start.sh
EOF

ENV NODE_ENV=production \
    PORT=3000 \
    API_PORT=8080 \
    NEXT_PUBLIC_API_BASE_URL="http://localhost:8080"

EXPOSE 3000 8080

# Frontend healthcheck (change path if you like)
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/ || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/usr/local/bin/start.sh"]
