#!/usr/bin/env bash
# =============================================================================
# Database restore script for Milk Delivery Platform.
#
# Restores a PostgreSQL custom-format dump created by backup.sh.
#
# Usage:
#   ./scripts/restore.sh <path-to-dump-file>
#
# Environment variables:
#   DATABASE_URL — Full PostgreSQL connection string
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Validate arguments
# ---------------------------------------------------------------------------
if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file.dump>" >&2
  echo "" >&2
  echo "Example:" >&2
  echo "  $0 ./backups/milkdelivery_20240101_020000.dump" >&2
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[ERROR] Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL is not set. Aborting restore." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Confirm
# ---------------------------------------------------------------------------
echo "========================================"
echo " Milk Delivery Platform — Database Restore"
echo "========================================"
echo ""
echo "  Backup file : ${BACKUP_FILE}"
echo "  Target DB   : ${DATABASE_URL%%@*}@***"
echo ""
echo "  WARNING: This will overwrite existing data in the target database."
echo ""
read -rp "  Continue? [y/N] " confirm
if [[ ! "${confirm}" =~ ^[Yy]$ ]]; then
  echo "Restore cancelled."
  exit 0
fi

# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------
echo ""
echo "[$(date --iso-8601=seconds)] Starting restore from ${BACKUP_FILE}..."
pg_restore "${DATABASE_URL}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --single-transaction \
  "${BACKUP_FILE}"

echo "[$(date --iso-8601=seconds)] Restore complete."
