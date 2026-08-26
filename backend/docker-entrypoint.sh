#!/bin/sh
set -eu

echo "Applying Prisma migrations..."
bunx prisma migrate deploy

exec "$@"
