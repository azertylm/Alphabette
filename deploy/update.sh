#!/usr/bin/env bash
# Mise à jour du hub après un push sur GitHub (en root) : bash /opt/alphabette/deploy/update.sh
set -euo pipefail
export PATH=/root/.bun/bin:$PATH
cd /opt/alphabette
# --autostash garde les changements faits depuis /admin (registre) pendant la mise à jour.
git pull --autostash
bun install
bun run build
chown -R alphabette:alphabette /opt/alphabette
systemctl restart alphabette
echo ">>> Hub à jour."
