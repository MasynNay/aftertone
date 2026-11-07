#!/bin/zsh
# AFTERTONE Mac launcher: open the local music discovery application.
cd -- "$(dirname -- "$0")/../.." || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo 'AFTERTONE needs Node.js 20 or newer: https://nodejs.org/'
  read -k 1 '?Press any key to close...'
  exit 1
fi
( sleep 1; open 'http://127.0.0.1:4173' ) &
exec node server.mjs
