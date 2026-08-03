#!/usr/bin/env bash
# One-time bootstrap for an Oracle Cloud "Always Free" ARM (Ampere A1) VM
# running Ubuntu 22.04/24.04. Installs Docker, opens the firewall for HTTP/HTTPS
# (Oracle's Ubuntu images block everything but SSH by default — the #1 gotcha),
# and prints the remaining steps. Safe to re-run (idempotent).
#
#   curl -fsSL <raw-url>/setup-vm.sh | bash      # or: bash setup-vm.sh
set -euo pipefail

echo "==> Oracle VM bootstrap starting"

# --- 1. Docker ---
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "==> Docker installed. You'll need to log out/in (or run 'newgrp docker') for group changes."
else
  echo "==> Docker already installed: $(docker --version)"
fi

# docker compose plugin (get.docker.com includes it; verify)
if ! docker compose version >/dev/null 2>&1; then
  echo "==> Installing docker compose plugin..."
  sudo apt-get update -y && sudo apt-get install -y docker-compose-plugin
fi

# --- 2. Firewall (host iptables) ---
# Oracle's Ubuntu image ships an INPUT chain that REJECTs everything except SSH.
# Insert ACCEPT rules for 80/443 BEFORE that reject, then persist them.
echo "==> Opening host firewall for 80/443..."
sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT 6 -p tcp --dport 80 -m state --state NEW,ESTABLISHED -j ACCEPT
sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT 6 -p tcp --dport 443 -m state --state NEW,ESTABLISHED -j ACCEPT

# Persist iptables across reboots
if ! command -v netfilter-persistent >/dev/null 2>&1; then
  sudo apt-get update -y && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
fi
sudo netfilter-persistent save || true

cat <<'NEXT'

==> Host setup done.

STILL REQUIRED (do these once):
  1. In the Oracle Cloud CONSOLE → your VCN → Security List → add Ingress rules:
       - Source 0.0.0.0/0, TCP, dest port 80
       - Source 0.0.0.0/0, TCP, dest port 443
     (The host firewall above is separate from this cloud-level firewall — you need BOTH.)

  2. Point your domain's DNS  A record  at this VM's public IP.

  3. Deploy:
       cd business-dashboard/deploy/oracle
       cp .env.example .env && nano .env      # fill in real values (incl. APP_DOMAIN, NEXTAUTH_URL)
       docker compose up -d --build

  4. In Google Cloud OAuth console, add the authorized redirect URI:
       https://<your-domain>/api/auth/callback/google

  Check logs:   docker compose logs -f
NEXT
echo "==> Done."
