#!/usr/bin/env bash
# Export rekordbox's analyzed BPM as ground truth for the validation harness.
#
# rekordbox's master.db is a SQLCipher database. The passphrase below is a
# fixed, app-derived data key (the same on every rekordbox 7.2.x install) -- it
# is NOT a user credential. See ../audiosort/docs/rekordbox-internals.md (and
# RekordboxSyncService.deobfuscateKey for how it's derived from the binary).
#
# djmdContent.BPM is an INTEGER stored x100 (e.g. 12700 = 127.00 BPM).
# Output: ground-truth.tsv  (columns: BPMx100 <TAB> FolderPath), one row/track.
set -euo pipefail

DB="${REKORDBOX_DB:-$HOME/Library/Pioneer/rekordbox/master.db}"
KEY="402fd482c38817c35ffa8ffb8c7d93143b749e7d315df7a81732a1ff43608497"
OUT="$(dirname "$0")/ground-truth.tsv"

if [ ! -f "$DB" ]; then
  echo "rekordbox master.db not found at: $DB" >&2
  exit 1
fi

sqlcipher -batch -noheader -separator $'\t' "$DB" \
  "PRAGMA key='$KEY'; SELECT BPM, FolderPath FROM djmdContent WHERE BPM IS NOT NULL AND BPM > 0;" \
  > "$OUT"

echo "Wrote $(wc -l < "$OUT" | tr -d ' ') rows to $OUT"
