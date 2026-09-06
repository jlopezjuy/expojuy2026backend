#!/bin/sh

sleep 10
# npm run typeorm:migration:run -w server
# npm run typeorm:schema:sync -w server
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "${SCRIPT_DIR}/../dist/main.js"
