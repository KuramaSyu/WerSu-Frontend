#!/bin/sh
# Renders `/env.js` from container env vars, then hands over to Caddy.
#
# The nginx image used to run `docker/runtime-env.sh` as a
# `/docker-entrypoint.d/*.sh` hook; Caddy has no such convention, so we
# wrap its start command explicitly.
set -eu

/usr/local/bin/runtime-env.sh
exec /usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
