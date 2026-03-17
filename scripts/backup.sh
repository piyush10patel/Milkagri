#!/usr/bin/env bash
# =============================================================================
# Automated daily PostgreSQL backup script for Milk Delivery Platform.
#
# Uses pg_dump with custom format for efficient, compressed backups.
# Supports configurable retention via BACKUP_RETENTION_DAYS.
#
# Environment variables (read from .env or passed directly):
#   DATABASE_URL          — Full PostgreSQL connection string
#   BACKUP_DIR            — Directory to store backup files (default: ./backups)
#   BACKUP_RETENTION_DAYS — Number of days to retain backups (default: 30)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/milkdelivery_${TIMESTAMP}.dump"

# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL is not set. Aborting backup." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Ensure backup directory exists
# ---------------------------------------------------------------------------
mkdir -p "${BACKUP_DIR}"

# ---------------------------------------------------------------------------
# Run pg_dump (custom format = compressed, supports pg_restore)
# ---------------------------------------------------------------------------
echo "[$(date --iso-8601=seconds)] Starting backup → ${BACKUP_FILE}"
pg_dump "${DATABASE_URL}" --format=custom --no-owner --no-acl --file="${BACKUP_FILE}"
echo "[$(date --iso-8601=seconds)] Backup complete ($(du -h "${BACKUP_FILE}" | cut -f1))"

# ---------------------------------------------------------------------------
# Cleanup old backups beyond retention period
# ---------------------------------------------------------------------------
echo "[$(date --iso-8601=seconds)] Removing backups older than ${BACKUP_RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "milkdelivery_*.dump" -type f -mtime "+${BACKUP_RETENTION_DAYS}" -delete
REMAINING=$(find "${BACKUP_DIR}" -name "milkdelivery_*.dump" -type f | wc -l)
echo "[$(date --iso-8601=seconds)] Retention cleanup done. ${REMAINING} backup(s) on disk."
