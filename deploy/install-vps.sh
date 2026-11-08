#!/usr/bin/env bash
# Installation du hub alphabette.fr sur un VPS OVH neuf (Ubuntu 24.04), en root :
#   curl -fsSL https://raw.githubusercontent.com/azertylm/Alphabette/main/deploy/install-vps.sh | bash
# Installe Node 22, Bun, Caddy (HTTPS automatique), le hub et son service.
set -euo pipefail

APP_DIR=/opt/alphabette
REPO=https://github.com/azertylm/Alphabette

apt-get update
apt-get install -y git curl unzip gnupg debian-keyring debian-archive-keyring apt-transport-https ufw

# Node.js 22
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Bun (installation des dépendances et construction)
if [ ! -x /root/.bun/bin/bun ]; then
  curl -fsSL https://bun.sh/install | bash
fi
export PATH=/root/.bun/bin:$PATH

# Caddy (serveur web + certificats HTTPS Let's Encrypt automatiques)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

# Utilisateur dédié
id alphabette >/dev/null 2>&1 || useradd -m -s /bin/bash alphabette

# Code du hub
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
git pull --autostash

# Secrets (à compléter une seule fois)
if [ ! -f .env ]; then
  cat > .env <<ENV
NODE_ENV=production
PORT=3000
ADMIN_PASSWORD=$(openssl rand -base64 18)
ADMIN_SESSION_SECRET=$(openssl rand -hex 32)
MISTRAL_API_KEY=
ENV
  chmod 600 .env
  echo ">>> Mot de passe /admin généré : $(grep ADMIN_PASSWORD .env | cut -d= -f2-)"
fi

bun install
bun run build
chown -R alphabette:alphabette "$APP_DIR"

# Service : redémarre tout seul en cas de plantage ou de reboot
install -m 644 deploy/alphabette.service /etc/systemd/system/alphabette.service
systemctl daemon-reload
systemctl enable --now alphabette
systemctl restart alphabette

# Caddy
install -m 644 deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

# Pare-feu
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

echo ">>> Hub installé. Test local : curl -s localhost:3000/api/health"
