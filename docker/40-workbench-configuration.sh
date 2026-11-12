#!/bin/sh
# The official Nginx entrypoint runs executable /docker-entrypoint.d/*.sh scripts
# before starting Nginx. A generation error must stop startup.
set -eu

# Merge public environment settings over optional /etc/workbench/config.json and
# production defaults. The shared Node generator validates the result and writes
# /usr/share/nginx/html/assets/config.json atomically, leaving mounted input and
# bundled build-info.json unchanged. Container mode skips the repository .env.
exec node /opt/workbench/scripts/write-runtime-config.mjs --container --production
