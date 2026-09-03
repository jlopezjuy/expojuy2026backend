#!/bin/sh

sleep 10
# npm run typeorm:migration:run -w server
# npm run typeorm:schema:sync -w server
exec node /usr/node-app/server/dist/main.js
