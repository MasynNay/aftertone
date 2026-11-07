#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js 20+ is required. Install Node.js, then rerun this launcher.'
  read -k 1 '?Press a key to close...'
  exit 1
fi
node scripts/build.mjs || exit 1
(sleep 1; open 'http://127.0.0.1:4174') &
node scripts/preview.mjs
