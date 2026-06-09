#!/bin/sh
set -e
echo "Running migrations..."
node migrate.cjs
echo "Starting Next.js..."
exec node server.js
