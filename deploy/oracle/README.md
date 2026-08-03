# Migrating FinDash to Oracle Cloud (Always Free ARM)

Move off Render's 512MB / 0.1-CPU free box (which OOM-restarts under Chromium +
OCR) to an Oracle **Always Free** ARM VM: **2 OCPU / 12 GB RAM** — ~24× the RAM
and real CPU, at no cost, forever. The OOM problem disappears and the app gets
much faster.

Everything here lives on the `oracle-migration` branch and does **not** touch the
running Render deployment. You can run both in parallel and cut over only once
Oracle is verified.

## What's in this folder
| File | Purpose |
|------|---------|
| `docker-compose.yml` | Runs the app + Caddy (auto-HTTPS) |
| `Caddyfile` | Reverse proxy + free Let's Encrypt TLS |
| `.env.example` | Env template (copy to `.env`, fill in) |
| `setup-vm.sh` | One-time VM bootstrap (Docker + firewall) |

The app image is the **same `Dockerfile`** used on Render — it's already
multi-arch (Debian `node:20-slim` + `chromium`/`tesseract`/`poppler`, all
available on ARM64). The only prod difference is a larger Node heap, set in
`docker-compose.yml`.

## Prerequisites
- An Oracle Cloud account (free signup; a credit card is required for identity
  verification but **Always Free resources are not charged**). Keep the account
  in the Always-Free tier — don't "upgrade to Pay-As-You-Go".
- A domain or free subdomain (e.g. [DuckDNS](https://www.duckdns.org)) — Google
  OAuth needs an HTTPS callback, which needs a real hostname.

---

## Step 1 — Create the VM (OCI console)
1. **Compute → Instances → Create instance.**
2. **Image:** Canonical **Ubuntu 24.04** (or 22.04).
3. **Shape:** change to **Ampere → VM.Standard.A1.Flex**, set **2 OCPU / 12 GB**
   (the full free allowance).
4. Add your **SSH public key** (or let it generate one).
5. Create.

> **Capacity gotcha:** busy regions often return *"Out of host capacity"* for
> ARM. If so, try again later, pick a different **Availability Domain**, or a
> less-busy home region. This is the most common Oracle friction point.

## Step 2 — Open the cloud firewall (Security List)
Networking → your **VCN → Security Lists → Default → Add Ingress Rules**:
- Source `0.0.0.0/0`, IP Protocol TCP, **Destination port 80**
- Source `0.0.0.0/0`, IP Protocol TCP, **Destination port 443**

(This is Oracle's cloud-level firewall. The host also has its own iptables —
`setup-vm.sh` handles that. You need **both**.)

## Step 3 — Bootstrap the VM
SSH in (`ssh ubuntu@<public-ip>`), then:
```bash
sudo apt-get update -y && sudo apt-get install -y git
git clone https://github.com/Edish1-glitch/business-dashboard.git
cd business-dashboard
git checkout oracle-migration          # until this is merged to main
bash deploy/oracle/setup-vm.sh
newgrp docker                          # apply docker group without re-login
```

## Step 4 — DNS
Point your domain's **A record** at the VM's **public IP**. Wait for it to
resolve (`ping your-domain`).

## Step 5 — Configure and launch
```bash
cd deploy/oracle
cp .env.example .env
nano .env      # fill EVERY value (copy secrets from Render's env; set APP_DOMAIN + NEXTAUTH_URL)
docker compose up -d --build
docker compose logs -f      # watch it build + boot; Caddy will fetch the TLS cert
```
First build takes a few minutes (installs OCR/Chromium, runs `next build`). Caddy
gets HTTPS automatically once DNS resolves and ports 80/443 are open.

## Step 6 — Google OAuth
In the Google Cloud Console → your OAuth client → **Authorized redirect URIs**,
add:
```
https://<your-domain>/api/auth/callback/google
```
(Keep the Render one too during the parallel-run.)

## Step 7 — Verify (before cutover)
Visit `https://<your-domain>` and check:
- [ ] Padlock / valid HTTPS
- [ ] Google login works
- [ ] Dashboard, pending, approved pages load
- [ ] **Upload a scanned multi-page PDF** → OCR completes, no crash (this is the
      workload that OOM'd Render — watch `docker stats`, memory should sit far
      below 12 GB)
- [ ] Download an invoice PDF (HTML→PDF / Chromium works)
- [ ] Gmail sync runs

`docker stats` should show the app using a few hundred MB even under load — with
12 GB there's enormous headroom.

---

## Cutover (zero-downtime)
Both hosts share the same Neon database, so they're interchangeable:
1. Run Oracle in parallel and complete Step 7.
2. When happy, switch your **primary domain's DNS** to the VM (if it wasn't
   already the primary), and make its OAuth redirect the canonical one.
3. Optionally suspend the Render service (or leave it as a warm standby).

## Rollback
Point DNS/OAuth back at the Render URL. Nothing else changes (same DB, same R2).

## Updates & ops
```bash
cd business-dashboard && git pull && docker compose -f deploy/oracle/docker-compose.yml up -d --build
```
- `restart: always` + Docker's boot service → the app comes back automatically
  after a reboot.
- Logs: `docker compose logs -f app`
- Resource use: `docker stats`

## Notes / caveats
- **Heap:** `docker-compose.yml` sets `--max-old-space-size=2048` (vs Render's
  350). Fine for 12 GB. Raise if ever needed.
- **DB:** points at the same Neon Postgres as Render. `setup-db.mjs` runs
  `prisma db push` on boot; since the schema already matches, it's a no-op.
- **Oracle free-tier terms changed once in 2026 (4/24 → 2/12) without notice** —
  worth a periodic glance, but 2 OCPU / 12 GB is still ample here.
