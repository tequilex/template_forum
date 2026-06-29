#!/bin/sh
set -e

export AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ru-1}"

DATE=$(date +%Y-%m-%d-%H%M)
FILE="backup-${DATE}.sql.gz"
LOCAL="/tmp/${FILE}"

echo "[backup] starting at $(date -Iseconds)"
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h db -U app -d app \
  --no-owner --no-acl --format=plain \
  | gzip -9 > "${LOCAL}"
SIZE=$(du -h "${LOCAL}" | cut -f1)
echo "[backup] dump done: ${FILE} (${SIZE})"

aws --endpoint-url="${BACKUP_S3_ENDPOINT}" \
    s3 cp "${LOCAL}" "s3://${BACKUP_S3_BUCKET}/db/${FILE}"

rm "${LOCAL}"
echo "[backup] uploaded: s3://${BACKUP_S3_BUCKET}/db/${FILE}"
