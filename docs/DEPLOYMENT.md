# Deployment Guide

This guide covers deploying the Headless WhatsApp Interface to a self-hosted server using either Docker or PM2.

---

## Table of Contents

1. [Server Requirements](#server-requirements)
2. [Docker Deployment](#docker-deployment)
3. [PM2 Deployment](#pm2-deployment)
4. [Reverse Proxy Setup (Nginx)](#reverse-proxy-setup-nginx)
5. [SSL Certificate (Let's Encrypt)](#ssl-certificate-lets-encrypt)
6. [Health Checks](#health-checks)
7. [Monitoring & Logs](#monitoring--logs)
8. [Troubleshooting](#troubleshooting)

---

## Server Requirements

### Minimum Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **CPU** | 1 vCPU | 2 vCPU |
| **RAM** | 1 GB | 2 GB |
| **Disk** | 10 GB | 20 GB |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Software Dependencies

| Software | Version | Purpose |
|----------|---------|---------|
| **Docker** | 20.10+ | Container runtime |
| **Docker Compose** | 2.0+ | Container orchestration |
| **Node.js** | 20 LTS | (PM2 only) Runtime |
| **PM2** | 5.0+ | (PM2 only) Process manager |
| **Nginx** | 1.18+ | Reverse proxy |
| **Certbot** | Latest | SSL certificates |

---

## Docker Deployment

### Prerequisites

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Step 1: Clone Repository

```bash
git clone <your-repo-url> /opt/whatsapp-interface
cd /opt/whatsapp-interface
```

### Step 2: Configure Environment

```bash
# Create environment file
cp docs/ENV_SETUP.md .env.local

# Edit with your credentials
nano .env.local
```

Required variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
META_ACCESS_TOKEN=EAAxxxxxxx...
META_PHONE_NUMBER_ID=123456789012345
META_WABA_ID=987654321098765
```

### Step 3: Build and Start

```bash
# Build the Docker image
docker compose build

# Start in detached mode
docker compose up -d

# Verify container is running
docker compose ps
```

### Step 4: Verify Deployment

```bash
# Check logs
docker compose logs -f

# Test health endpoint
curl http://localhost:3000/api/health
```

### Docker Commands Reference

```bash
# Stop application
docker compose down

# Restart application
docker compose restart

# View logs
docker compose logs -f whatsapp-interface

# Rebuild after code changes
docker compose up -d --build

# Remove containers and images
docker compose down --rmi all
```

---

## PM2 Deployment

### Prerequisites

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Verify installation
node --version
pm2 --version
```

### Step 1: Clone and Install

```bash
git clone <your-repo-url> /opt/whatsapp-interface
cd /opt/whatsapp-interface

# Install dependencies
npm ci
```

### Step 2: Configure Environment

```bash
# Create environment file
nano .env.local

# Add your environment variables
```

### Step 3: Build Application

```bash
# Build for production
npm run build
```

### Step 4: Start with PM2

```bash
# Create logs directory
mkdir -p logs

# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 startup script (auto-start on reboot)
pm2 startup
```

### Step 5: Verify Deployment

```bash
# Check status
pm2 status

# View logs
pm2 logs whatsapp-interface

# Monitor resources
pm2 monit
```

### PM2 Commands Reference

```bash
# Stop application
pm2 stop whatsapp-interface

# Restart application
pm2 restart whatsapp-interface

# Reload (zero-downtime)
pm2 reload whatsapp-interface

# Delete from PM2
pm2 delete whatsapp-interface

# View detailed info
pm2 show whatsapp-interface
```

### Cluster Mode (Multi-Core)

Edit `ecosystem.config.js` to enable cluster mode:

```javascript
{
  instances: "max",      // Use all CPU cores
  exec_mode: "cluster",  // Enable cluster mode
}
```

Then restart:
```bash
pm2 restart ecosystem.config.js --env production
```

---

## Reverse Proxy Setup (Nginx)

### Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

### Create Server Block

```bash
sudo nano /etc/nginx/sites-available/whatsapp-interface
```

Add configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy settings
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for long-running connections (Realtime)
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://127.0.0.1:3000/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### Enable Site

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/whatsapp-interface /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## SSL Certificate (Let's Encrypt)

### Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx
```

### Obtain Certificate

```bash
sudo certbot --nginx -d your-domain.com
```

Follow the prompts to:
1. Enter email address
2. Agree to terms
3. Choose redirect option (recommended: redirect HTTP to HTTPS)

### Auto-Renewal

Certbot automatically sets up renewal. Verify with:

```bash
sudo certbot renew --dry-run
```

### Final Nginx Configuration (with SSL)

After Certbot, your config will look like:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ... rest of configuration
}
```

---

## Health Checks

### Create Health Check Endpoint

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
  });
}
```

### Test Health Check

```bash
# Local
curl http://localhost:3000/api/health

# With domain
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-13T12:00:00.000Z",
  "version": "0.1.0"
}
```

### External Monitoring

Configure uptime monitoring with:
- [UptimeRobot](https://uptimerobot.com/) (free tier available)
- [Pingdom](https://www.pingdom.com/)
- [StatusCake](https://www.statuscake.com/)

---

## Monitoring & Logs

### Docker Logs

```bash
# Follow logs
docker compose logs -f

# Last 100 lines
docker compose logs --tail 100

# Specific time range
docker compose logs --since 1h
```

### PM2 Logs

```bash
# All logs
pm2 logs

# Specific app
pm2 logs whatsapp-interface

# Flush logs
pm2 flush
```

### Log Rotation (PM2)

```bash
# Install log rotate module
pm2 install pm2-logrotate

# Configure (optional)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### System Monitoring

```bash
# Real-time PM2 dashboard
pm2 monit

# Docker stats
docker stats whatsapp-interface
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check Docker logs
docker compose logs --tail 50

# Check PM2 logs
pm2 logs whatsapp-interface --lines 50

# Verify environment variables
docker compose config  # Docker
pm2 env 0              # PM2
```

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>
```

### Memory Issues

```bash
# Check memory usage
free -h

# Docker memory
docker stats

# PM2 memory
pm2 monit
```

### Build Failures

```bash
# Clear Docker cache
docker builder prune

# Clear npm cache
npm cache clean --force

# Rebuild
npm ci && npm run build
```

### Database Connection Issues

1. Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
2. Check network connectivity to Supabase
3. Verify RLS policies allow access

### Meta API Issues

1. Verify `META_ACCESS_TOKEN` is valid and not expired
2. Check token permissions
3. Test with curl:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://graph.facebook.com/v18.0/YOUR_PHONE_ID"
   ```

---

## Quick Reference

### Docker

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start containers |
| `docker compose down` | Stop containers |
| `docker compose logs -f` | Follow logs |
| `docker compose restart` | Restart containers |
| `docker compose up -d --build` | Rebuild and start |

### PM2

| Command | Description |
|---------|-------------|
| `pm2 start ecosystem.config.js` | Start application |
| `pm2 stop whatsapp-interface` | Stop application |
| `pm2 restart whatsapp-interface` | Restart application |
| `pm2 logs` | View logs |
| `pm2 monit` | Monitor dashboard |

---

*Document Version: 1.0*
*Last Updated: January 2026*
