#!/usr/bin/env bash
# Upload dist/portfolio-wiktoria/ to a hosting account (e.g. seohost.pl) over FTPS.
# Usage: tools/deploy_ftp.sh <ftp-host> <ftp-user> <remote-dir>
#   e.g. tools/deploy_ftp.sh s123.seohost.pl jan@domena.pl /public_html/portfolio-wiktoria
# The password is asked interactively and never stored.
set -euo pipefail

HOST="${1:?ftp host, e.g. s123.seohost.pl}"
USER_NAME="${2:?ftp user}"
REMOTE="${3:?remote dir, e.g. /public_html or /public_html/portfolio-wiktoria}"
REMOTE="${REMOTE%/}"
SRC="$(cd "$(dirname "$0")/.." && pwd)/dist/portfolio-wiktoria"

[ -f "$SRC/index.html" ] || { echo "No export at $SRC — run: python3 -I tools/export.py" >&2; exit 1; }

read -r -s -p "FTP password for $USER_NAME@$HOST: " PASS; echo
CFG="$(mktemp)"; trap 'rm -f "$CFG"' EXIT
chmod 600 "$CFG"
printf 'user = "%s:%s"\n' "$USER_NAME" "$PASS" > "$CFG"
unset PASS

cd "$SRC"
find . -type f ! -name '.DS_Store' | sed 's|^\./||' | sort | while read -r f; do
  echo "→ $f"
  curl --silent --show-error --fail --ssl-reqd --ftp-create-dirs \
       --config "$CFG" -T "$f" "ftp://$HOST$REMOTE/$f"
done
echo "Done. Uploaded to ftp://$HOST$REMOTE/"
