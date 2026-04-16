# Galaxy Map Frontend — Test Deployment on AWS

This document describes how to deploy the Galaxy Map frontend (a static Vite + React SPA) to AWS on an EC2 instance with HTTPS.

The plan **co-locates the frontend on the same EC2 instance that already runs the backend API** (`i-09e6b9e94eef1fd27`). A single Caddy process on that instance:

- Serves the built React assets over HTTPS (Let's Encrypt cert, auto-renewed)
- Reverse-proxies `/api/*` requests to the Node API on `localhost:3001`

Chosen over a second EC2 because (a) it costs nothing extra on top of the existing free-tier instance, (b) the reverse-proxy lets the HTTPS frontend call the HTTP backend without mixed-content blocks or CORS headaches, and (c) there is one host, one security group, one DNS name, one certificate to manage.

An **Elastic IP** is required so the nip.io hostname and the Let's Encrypt certificate don't invalidate on stop/start.

---

## Deployed Instance Reference

This section records the live deployment created on 2026-04-16.

### AWS Resources

| Resource | Value |
|---|---|
| AWS Account ID | `403894226819` |
| Region | `us-east-1` |
| Instance ID | `i-09e6b9e94eef1fd27` _(shared with backend)_ |
| Security Group | `sg-00ed86f7f971a0f12` _(galaxy-map-sg — ports 22, 80, 443, 3001 open)_ |
| Elastic IP allocation | `eipalloc-0639b7f16f7e0ac71` |
| Elastic IP | `52.206.81.107` |
| Hostname | `galaxy-map-52-206-81-107.nip.io` |

### URLs

| Item | Value |
|---|---|
| Frontend | `https://galaxy-map-52-206-81-107.nip.io` |
| API (via reverse proxy) | `https://galaxy-map-52-206-81-107.nip.io/api/systems` |
| API (direct, pre-existing) | `http://52.206.81.107:3001/api/systems` |

### Environment at build time

| Variable | Value |
|---|---|
| `VITE_API_BASE` | `https://galaxy-map-52-206-81-107.nip.io/api` |

> `VITE_API_BASE` is baked into the JS bundle at build time. If the hostname changes, you must rebuild and re-upload.

### SSH access

The original `galaxy-map-key.pem` was not present locally at deployment time. A fresh RSA keypair was generated and authorized on the instance via AWS EC2 Instance Connect:

- **Key file:** `~/.ssh/galaxy-map-key.pem` (newly generated 2026-04-16)
- **Public key:** appended to `ec2-user`'s `authorized_keys` through `aws ec2-instance-connect send-ssh-public-key`
- The original AWS-registered key pair `galaxy-map-key` is still valid; the new key was added alongside it

```bash
ssh -i ~/.ssh/galaxy-map-key.pem ec2-user@galaxy-map-52-206-81-107.nip.io
```

### Quick-redeploy (after a frontend code change)

```bash
cd /Users/zachbagley/galaxyMap/galaxy-map
VITE_API_BASE=https://galaxy-map-52-206-81-107.nip.io/api npm run build

rsync -avz --delete \
  -e "ssh -i ~/.ssh/galaxy-map-key.pem" \
  dist/ ec2-user@galaxy-map-52-206-81-107.nip.io:~/galaxy-map-frontend/

ssh -i ~/.ssh/galaxy-map-key.pem ec2-user@galaxy-map-52-206-81-107.nip.io \
  "sudo rsync -a --delete ~/galaxy-map-frontend/ /var/www/galaxy-map/"
```

No Caddy restart is needed — it watches the filesystem.

---

**Cost:** $0 on top of the existing backend EC2 while free-tier applies. After free tier, the only new charge is the Elastic IP while the instance is stopped (~$0.005/hour, free while running and associated).

**Architecture:**

```
Browser ──HTTPS──▶ Caddy (EC2 :443)
                     │
                     ├── /api/*  ──▶ Node API (localhost:3001) ──▶ MySQL (localhost:3306)
                     └── else    ──▶ static files in /var/www/galaxy-map
```

Only ports 22, 80, and 443 are exposed publicly. Port 3001 can optionally be closed once the reverse proxy is verified.

---

## Prerequisites

- Backend from `backend/TEST-DEPLOYMENT.md` is deployed and healthy
- AWS CLI configured with the same credentials used for the backend
- SSH access to the instance via `~/.ssh/galaxy-map-key.pem`
- Node 20+ locally

---

## Step 1 — Allocate and Associate an Elastic IP

A stable public IP is required so the nip.io hostname and the Let's Encrypt certificate survive instance restarts.

```bash
INSTANCE_ID=i-09e6b9e94eef1fd27

ALLOC_ID=$(aws ec2 allocate-address \
  --query 'AllocationId' \
  --output text)

aws ec2 associate-address \
  --instance-id $INSTANCE_ID \
  --allocation-id $ALLOC_ID

# Fetch the Elastic IP that was assigned
ELASTIC_IP=$(aws ec2 describe-addresses \
  --allocation-ids $ALLOC_ID \
  --query 'Addresses[0].PublicIp' \
  --output text)

echo "Elastic IP: $ELASTIC_IP"
echo "Allocation ID: $ALLOC_ID"
```

Record both values in the reference table above.

---

## Step 2 — Open Ports 80 and 443

Caddy needs port 80 for the ACME HTTP-01 challenge (Let's Encrypt cert issuance) and port 443 to serve HTTPS.

```bash
SG_ID=sg-00ed86f7f971a0f12

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp --port 443 --cidr 0.0.0.0/0
```

---

## Step 3 — Derive the nip.io Hostname

nip.io is a free wildcard DNS service: any hostname of the form `anything-<ip>.nip.io` resolves to that IP. No registration, no configuration.

```bash
# From the Elastic IP above, e.g. 107.22.141.149
DASHED_IP=$(echo $ELASTIC_IP | tr '.' '-')
HOSTNAME="galaxy-map-$DASHED_IP.nip.io"
echo "Hostname: $HOSTNAME"

# Sanity-check resolution
dig +short $HOSTNAME   # should print $ELASTIC_IP
```

Record the hostname in the reference table.

---

## Step 4 — Build the Frontend Locally

On your local machine, from the `galaxy-map/` directory:

```bash
VITE_API_BASE=https://$HOSTNAME/api npm run build
```

The output lands in `dist/`. Confirm `index.html` and an `assets/` folder are present.

---

## Step 5 — Install Caddy on the EC2 Instance

SSH in using the new hostname (so you confirm DNS resolution works along the way):

```bash
ssh -i ~/.ssh/galaxy-map-key.pem ec2-user@$HOSTNAME
```

Inside the instance:

```bash
# Caddy provides an official RPM repo
sudo dnf install -y 'dnf-command(copr)'
sudo dnf copr enable -y @caddy/caddy
sudo dnf install -y caddy

caddy version   # sanity check

# Enable on boot but don't start yet — we still need the Caddyfile
sudo systemctl enable caddy
```

---

## Step 6 — Create the Web Root and Upload the Build

On the instance:

```bash
sudo mkdir -p /var/www/galaxy-map
sudo chown ec2-user:ec2-user /var/www/galaxy-map
mkdir -p ~/galaxy-map-frontend
```

From your **local machine**, in a second terminal:

```bash
rsync -avz --delete \
  -e "ssh -i ~/.ssh/galaxy-map-key.pem" \
  /Users/zachbagley/galaxyMap/galaxy-map/dist/ \
  ec2-user@$HOSTNAME:~/galaxy-map-frontend/
```

Back on the instance, copy into the Caddy-served directory (a two-step upload keeps the web root writable only by root):

```bash
sudo rsync -a --delete ~/galaxy-map-frontend/ /var/www/galaxy-map/
ls /var/www/galaxy-map/   # should show index.html, assets/, ...
```

---

## Step 7 — Write the Caddyfile

On the instance:

```bash
sudo tee /etc/caddy/Caddyfile > /dev/null << EOF
galaxy-map-$DASHED_IP.nip.io {
    encode gzip

    handle /api/* {
        reverse_proxy localhost:3001
    }

    handle {
        root * /var/www/galaxy-map
        try_files {path} /index.html
        file_server
    }
}
EOF
```

Notes:
- `handle /api/*` matches before the catch-all `handle`, so API calls go to the Node process and everything else falls through to static files.
- `try_files {path} /index.html` is the SPA fallback — deep links like `/systems/412` resolve to `index.html` instead of 404.
- The path is preserved through the proxy: `https://host/api/systems` → `http://localhost:3001/api/systems`, which is what the API expects.

Validate the config before starting:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

---

## Step 8 — Start Caddy (HTTPS Cert Issued Automatically)

```bash
sudo systemctl start caddy

# Watch Caddy acquire the Let's Encrypt cert — takes 10–30 seconds
sudo journalctl -u caddy -f
# Look for a line like: "certificate obtained successfully"
# Ctrl-C to exit the log stream

sudo systemctl status caddy   # should show active (running)
```

If cert issuance fails, the most common causes are: port 80 not actually open, the nip.io hostname not yet resolving to the Elastic IP, or the instance blocking outbound HTTPS to Let's Encrypt (default security groups allow all outbound — verify).

---

## Step 9 — Smoke Test

From your local machine:

```bash
# Cert + HTTPS working?
curl -I https://$HOSTNAME/
# HTTP/2 200 — and no cert warnings

# API reverse proxy working?
curl https://$HOSTNAME/api/systems/grid/J/8

# Single system
curl https://$HOSTNAME/api/systems/1161

# SPA fallback working?
curl -I https://$HOSTNAME/systems/412
# HTTP/2 200, content-type: text/html (serves index.html)
```

In the browser — open `https://<hostname>`:

1. Padlock icon, no certificate warning
2. Grid loads with systems (no "SIGNAL LOST" overlay)
3. Clicking a cell populates the system list panel
4. Clicking a system row navigates to `/systems/:id` and renders the detail page
5. Hard refresh on a detail page URL still resolves (SPA fallback confirmed)
6. DevTools Network tab: XHRs go to `https://<hostname>/api/...` and return 200, no mixed-content warnings

---

## Optional Hardening — Close Port 3001

With the reverse proxy in place, the API no longer needs to be reachable from the public internet; browsers go through Caddy on 443, and Caddy reaches the API on `localhost:3001`.

```bash
aws ec2 revoke-security-group-ingress \
  --group-id sg-00ed86f7f971a0f12 \
  --protocol tcp --port 3001 --cidr 0.0.0.0/0
```

After this, the direct `http://<ip>:3001/api/...` URL will stop working — only `https://<hostname>/api/...` routes through. Update the backend `TEST-DEPLOYMENT.md` reference table accordingly if you do this.

---

## Redeploying Updated Code

```bash
# 1. Rebuild locally
cd /Users/zachbagley/galaxyMap/galaxy-map
VITE_API_BASE=https://$HOSTNAME/api npm run build

# 2. Ship dist/ up
rsync -avz --delete \
  -e "ssh -i ~/.ssh/galaxy-map-key.pem" \
  dist/ ec2-user@$HOSTNAME:~/galaxy-map-frontend/

# 3. Move into the web root
ssh -i ~/.ssh/galaxy-map-key.pem ec2-user@$HOSTNAME \
  "sudo rsync -a --delete ~/galaxy-map-frontend/ /var/www/galaxy-map/"
```

Caddy serves directly from the filesystem — no restart, no cache to invalidate.

---

## Handling a Hostname Change

If the Elastic IP ever changes (e.g. you release and re-allocate it), the nip.io hostname changes too, and the existing Let's Encrypt cert no longer matches. To rotate:

1. Update the `Caddyfile` with the new hostname and `sudo systemctl reload caddy` — Caddy provisions a fresh cert.
2. Rebuild the frontend with the new `VITE_API_BASE` and redeploy (see above).
3. Update the reference table at the top of this doc.

Keeping the Elastic IP attached to the running instance avoids this entirely — that's why it's in Step 1.

---

## Useful Commands (run on the instance)

```bash
sudo systemctl status caddy           # Caddy health
sudo systemctl reload caddy           # re-read Caddyfile (e.g. after editing)
sudo journalctl -u caddy -f           # live Caddy logs
sudo journalctl -u caddy --since "10m ago"
sudo caddy validate --config /etc/caddy/Caddyfile
ls -la /var/www/galaxy-map/           # inspect what's being served
```

---

## Cost Estimate

| Resource | Free Tier | After Free Tier |
|---|---|---|
| EC2 t2.micro (shared with backend) | Free for 12 months | ~$8.50/month (already counted in backend) |
| EBS storage (shared with backend) | Free for 12 months | ~$2.40/month (already counted in backend) |
| Elastic IP (attached to running instance) | Free | Free while attached and running |
| Elastic IP (while instance is stopped) | Free for a small allowance | ~$0.005/hour (~$3.60/month if always stopped) |
| Data transfer out | First 100 GB/month free | $0.09/GB |
| Caddy / Let's Encrypt | Free | Free |
| **Incremental cost over backend-only deployment** | **$0** | **$0 while running** |

---

## Why Caddy instead of nginx + certbot?

Caddy issues and renews Let's Encrypt certificates automatically with zero configuration — one `Caddyfile` replaces an nginx `server` block, a certbot cron job, and the nginx reload hook. For a single-host, single-site deployment, Caddy reduces setup from ~20 minutes to ~5 and eliminates the class of bugs where certbot renews but nginx doesn't pick up the new cert.

## Why co-locate with the backend?

A second EC2 would double compute costs after free tier and would introduce cross-instance HTTP-to-HTTPS bridging (or force the backend onto HTTPS as well). Co-locating behind Caddy eliminates mixed-content issues, removes the need for CORS configuration, keeps the certificate story to a single host, and keeps the deploy scripts short.
