#!/bin/sh
set -e

apk add --no-cache aws-cli coreutils tzdata
export TZ=Europe/Moscow
export AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION=ru-1

while true; do
  NEXT=$(date -d "today 03:00" +%s)
  NOW=$(date +%s)
  if [ "${NOW}" -ge "${NEXT}" ]; then
    NEXT=$(date -d "tomorrow 03:00" +%s)
  fi
  SLEEP=$((NEXT - NOW))
  echo "[backup] sleeping ${SLEEP}s until $(date -d "@${NEXT}" -Iseconds)"
  sleep "${SLEEP}"
  sh /backup.sh || echo "[backup] FAILED at $(date -Iseconds)"
done
