#!/bin/sh
# Backup of the SQLite database and the photos. Run from cron inside the backup container.
set -eu

TS="$(date -u +%Y%m%dT%H%M%SZ)"
DATA_DIR="${DATA_DIR:-/data}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION="${BACKUP_RETENTION:-30}"
SRC="${DATA_DIR}/apogee.sqlite"
PHOTOS_SRC="${DATA_DIR}/photos"
DB_DEST="${BACKUP_DIR}/apogee-${TS}.sqlite"
PHOTOS_DEST="${BACKUP_DIR}/apogee-photos-${TS}.tar.gz"
# Everything is written under a hidden .partial name (matched by neither the rotation
# globs below nor the *.sqlite / *.tar.gz filters of the offsite sync), verified, and
# only then renamed (same folder, so atomic) to its final name. An interrupted run
# therefore never leaves an unverified file under a final name.
DB_PART="${BACKUP_DIR}/.apogee-${TS}.sqlite.partial"
PHOTOS_PART="${BACKUP_DIR}/.apogee-photos-${TS}.tar.gz.partial"

# Retention only ever considers files this script writes, so hand-named copies
# (apogee-avant-maj.sqlite) are never swept up by the rotation. The two globs are
# disjoint: apogee-photos-... does not match the .sqlite one, and vice versa.
DB_GLOB='apogee-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z.sqlite'
PHOTOS_GLOB='apogee-photos-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z.tar.gz'

log() { echo "[$(date -u +%FT%TZ)] $*"; }

# A failed database snapshot leaves nothing behind.
fail() {
  log "backup FAILED: $1"
  rm -f "$DB_PART" "${DB_PART}-journal" "$PHOTOS_PART"
  exit 1
}

# A bad retention value (empty, non-numeric, zero) must never turn the rotation
# into "delete everything": fall back to the default. (An empty value is already
# covered by the ${BACKUP_RETENTION:-30} default above.)
case "$RETENTION" in
  *[!0-9]* | 0*)
    log "invalid BACKUP_RETENTION '${RETENTION}', using 30"
    RETENTION=30
    ;;
esac

mkdir -p "$BACKUP_DIR"

# Sweep leftovers of an interrupted run (container killed mid-backup).
rm -f "${BACKUP_DIR}"/.apogee-*.partial*

# Skip gracefully if the source DB does not exist yet (first boot)
if [ ! -f "$SRC" ]; then
  log "source not found, skipping: $SRC"
  exit 0
fi

# Atomic backup using sqlite3 .backup (safe even if DB is open / writes in flight).
# sqlite3 exits 0 even when a dot-command fails, so its status proves nothing:
# the snapshot itself is verified below instead of trusted.
sqlite3 "$SRC" ".backup '${DB_PART}'" || true

[ -s "$DB_PART" ] || fail "no snapshot written, or it is empty"

if [ "$(sqlite3 "$DB_PART" 'PRAGMA integrity_check;' 2>/dev/null | head -n 1)" != "ok" ]; then
  fail "snapshot did not pass integrity_check"
fi
rm -f "${DB_PART}-journal"
mv "$DB_PART" "$DB_DEST"
log "database snapshot verified: $(basename "$DB_DEST")"

# Photos: archive and prove it is readable. On failure the valid DB snapshot is
# kept, the partial archive is removed and the rotation is skipped.
if [ -d "$PHOTOS_SRC" ]; then
  if ! tar -czf "$PHOTOS_PART" -C "$DATA_DIR" photos || ! tar -tzf "$PHOTOS_PART" >/dev/null; then
    rm -f "$PHOTOS_PART"
    log "backup FAILED: photos archive could not be written or read back (database snapshot kept)"
    exit 1
  fi
  mv "$PHOTOS_PART" "$PHOTOS_DEST"
  log "photos archive verified: $(basename "$PHOTOS_DEST")"
else
  log "no photos folder, skipping: $PHOTOS_SRC"
fi

# Retention: keep the newest N of each family (by name: the UTC timestamp is fixed-width,
# so name order is chronological, independent of file mtimes). Only reached once the whole run
# succeeded, so a failed run never prunes a good backup to make room for a bad one.
# shellcheck disable=SC2086 # the globs must stay unquoted to expand
ls -1 "${BACKUP_DIR}"/$DB_GLOB 2>/dev/null \
  | sort -r \
  | tail -n +$((RETENTION + 1)) \
  | xargs -r rm -f
# shellcheck disable=SC2086
ls -1 "${BACKUP_DIR}"/$PHOTOS_GLOB 2>/dev/null \
  | sort -r \
  | tail -n +$((RETENTION + 1)) \
  | xargs -r rm -f

log "backup written: $(basename "$DB_DEST")"
