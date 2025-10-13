# FIDU Chat Lab - Deployment Guide

## Overview

ChatLab can be deployed in multiple modes depending on your environment and security requirements. This guide covers everything from local development to production deployment with OpenBao.

---

## 🎯 Deployment Modes

ChatLab supports three deployment modes with intelligent fallback mechanisms.

### 🔒 Mode 1: Production with OpenBao (Most Secure)

**When to use**: Production deployments with centralized secret management

**Architecture**:
```
Frontend → Backend (OpenBao secrets) → Google OAuth → Backend → Frontend
```

**Security**: ✅ Highest
- Client secret stored in OpenBao vault
- Token exchange happens server-side
- Audit trail of secret access
- Easy credential rotation

**Configuration**:
```bash
# Backend environment
OPENBAO_ENABLED=true
OPENBAO_ADDRESS=https://openbao.yourcompany.com
OPENBAO_TOKEN=hvs.production-token
OPENBAO_SECRET_PATH=fidu/chatlab/prod

# Frontend environment
VITE_GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
# No VITE_GOOGLE_CLIENT_SECRET needed!
```

**Console logs**: `✅ Secrets loaded from OpenBao` → `✅ Token exchange via backend (secure)`

---

### 🔧 Mode 2: Backend with Environment Variables (Secure)

**When to use**: Development, staging, or production without OpenBao

**Architecture**:
```
Frontend → Backend (env var secrets) → Google OAuth → Backend → Frontend
```

**Security**: ✅ High
- Client secret in backend environment variables
- Token exchange happens server-side
- No secrets exposed to frontend

**Configuration**:
```bash
# Backend environment
OPENBAO_ENABLED=false  # or omit
GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret

# Frontend environment
VITE_GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
# No VITE_GOOGLE_CLIENT_SECRET needed
```

**Console logs**: `✅ Token exchange via backend (secure)`

---

### 💻 Mode 3: Frontend-Only Development (Fallback)

**When to use**: Local development, quick UI iterations

**Architecture**:
```
Frontend (VITE_* env vars) → Google OAuth → Frontend
```

**Security**: ⚠️ Development only
- Client secret in frontend environment variables
- Direct OAuth with Google
- **NOT for production**

**Configuration**:
```bash
# Frontend environment only
VITE_GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-secret  # Required for this mode
```

**Console logs**: `⚠️ Backend not available, falling back to direct OAuth (dev mode)`

---

### Automatic Mode Detection

The frontend automatically selects the most secure mode available:

1. **Tries backend first** (5 second timeout)
   - Calls `/api/oauth/exchange-code`
   - Success → Use Mode 1 or 2 ✅

2. **Falls back to direct OAuth** if backend unavailable
   - Checks for `VITE_GOOGLE_CLIENT_SECRET`
   - Present → Use Mode 3 🔧
   - Missing → Clear error message ❌

This allows `npm run dev` to work without backend while maintaining security in production.

---

## Prerequisites

1. **Node.js and npm** installed locally (for building)
2. **Python 3.8+** installed on deployment server
3. **SSH access** to deployment server
4. **OpenBao access** (optional, for Mode 1)
5. **Environment files** configured

---

## Environment Configuration

### Development Environment (`.env.development`)

```bash
# Identity Service (FIDU backend services)
VITE_IDENTITY_SERVICE_URL=https://dev.identity.firstdataunion.org
VITE_GATEWAY_URL=https://dev.gateway.firstdataunion.org

# Storage Configuration
VITE_STORAGE_MODE=cloud
VITE_SYNC_INTERVAL=300000

# Google OAuth - Frontend
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-secret  # For Mode 3 (frontend-only dev)

# Google OAuth - Backend (if running backend locally)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret

# OpenBao (optional for local dev)
OPENBAO_ENABLED=false

# Email allowlist (dev only - restricts access)
VITE_ALLOWED_EMAILS=team-member1@company.com,team-member2@company.com
```

### Production Environment (`.env.production` + server env)

```bash
# Frontend build variables
VITE_IDENTITY_SERVICE_URL=https://identity.firstdataunion.org
VITE_GATEWAY_URL=https://gateway.firstdataunion.org
VITE_STORAGE_MODE=cloud
VITE_SYNC_INTERVAL=300000
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
# ⚠️ NO VITE_GOOGLE_CLIENT_SECRET in production!

# Backend server environment (Mode 1 - OpenBao)
OPENBAO_ENABLED=true
OPENBAO_ADDRESS=https://openbao.yourcompany.com
OPENBAO_TOKEN=hvs.production-token
OPENBAO_SECRET_PATH=fidu/chatlab/prod
ENVIRONMENT=prod
PORT=8080

# Backend server environment (Mode 2 - fallback if OpenBao unavailable)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret
```

**Important Notes**:
- Frontend variables (`VITE_*`) are baked into build at compile time
- Backend variables are read at runtime
- Never set `VITE_GOOGLE_CLIENT_SECRET` in production builds

---

## Quick Start Deployment

### Local Development (Mode 3)

```bash
# Frontend only - no backend needed
cd src/apps/chat-lab
npm install
npm run dev

# Access at http://localhost:3000
```

### Full Stack Development (Mode 2)

```bash
# Terminal 1: Backend
cd src/apps/chat-lab
python backend/server.py

# Terminal 2: Frontend
npm run dev

# Backend at http://localhost:8080
# Frontend at http://localhost:3000
```

### Production Build (Mode 1 or 2)

```bash
# Build frontend
cd src/apps/chat-lab
npm run build

# Start backend (serves frontend)
python backend/server.py

# Access at http://localhost:8080/fidu-chat-lab
```

---

## Automated Deployment

### Using Deployment Script

The `deploy.sh` script automates deployment to remote servers:

```bash
# Deploy to development server (Mode 2)
./deploy.sh dev YOUR_SERVER_IP

# Deploy to production server (Mode 1 with OpenBao)
./deploy.sh prod YOUR_SERVER_IP

# Example
./deploy.sh dev 46.62.134.169
./deploy.sh prod 46.62.134.169
```

**What the script does**:
1. Builds React app with environment-specific config
2. Creates deployment package with backend
3. Uploads to server via SSH
4. Sets up systemd service
5. Configures and starts the service

### Deployment Paths on Server

- **Dev**: `/usr/local/bin/fidu-chat-lab-dev` (port 8119)
- **Prod**: `/usr/local/bin/fidu-chat-lab-prod` (port 8118)

### Server Directory Structure

```
/usr/local/bin/fidu-chat-lab-{env}/
├── dist/                 # Built React app
│   ├── index.html
│   └── assets/
├── backend/              # Python backend
│   ├── server.py
│   └── openbao_client.py
├── venv/                 # Python virtual environment
├── requirements.txt      # Python dependencies
└── .env                  # Runtime environment variables
```

---

## Manual Deployment

### Step 1: Build Frontend

```bash
cd src/apps/chat-lab

# For production
npm run build

# Verify build
ls -la dist/
```

### Step 2: Prepare Backend

```bash
# Copy backend files
mkdir -p deployment_package/backend
cp backend/*.py deployment_package/backend/
cp ../../requirements.txt deployment_package/

# Create virtual environment
cd deployment_package
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Configure Environment

Create `deployment_package/.env`:

```bash
# Mode 1 (OpenBao)
OPENBAO_ENABLED=true
OPENBAO_ADDRESS=https://openbao.yourcompany.com
OPENBAO_TOKEN=hvs.your-token
OPENBAO_SECRET_PATH=fidu/chatlab/prod
ENVIRONMENT=prod
PORT=8080

# Mode 2 (Fallback)
GOOGLE_CLIENT_ID=your-id
GOOGLE_CLIENT_SECRET=your-secret
```

### Step 4: Deploy to Server

```bash
# Copy to server
scp -r deployment_package user@server:/opt/chatlab

# On server, set up systemd service
sudo systemctl enable chatlab
sudo systemctl start chatlab
```

---

## Service Management

### Systemd Service

After deployment, services are managed via systemd:

```bash
# Check status
sudo systemctl status fidu-chat-lab-dev
sudo systemctl status fidu-chat-lab-prod

# View logs (live)
sudo journalctl -u fidu-chat-lab-dev -f
sudo journalctl -u fidu-chat-lab-prod -f

# Restart service
sudo systemctl restart fidu-chat-lab-dev
sudo systemctl restart fidu-chat-lab-prod

# Stop service
sudo systemctl stop fidu-chat-lab-dev
sudo systemctl stop fidu-chat-lab-prod

# Check health
curl http://localhost:8119/health  # dev
curl http://localhost:8118/health  # prod
```

### Service URLs

| Environment | Port | URL |
|------------|------|-----|
| Dev | 8119 | http://dev.chatlab.firstdataunion.org:8119/fidu-chat-lab |
| Prod | 8118 | http://chatlab.firstdataunion.org:8118/fidu-chat-lab |

---

## Production Setup

### Adding HTTPS with Nginx

For production, add nginx as reverse proxy with SSL:

#### 1. Install nginx and Certbot

```bash
sudo apt-get update
sudo apt-get install nginx certbot python3-certbot-nginx
```

#### 2. Configure nginx

Create `/etc/nginx/sites-available/chatlab`:

```nginx
server {
    listen 80;
    server_name chatlab.firstdataunion.org;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chatlab.firstdataunion.org;

    # SSL managed by Certbot
    ssl_certificate /etc/letsencrypt/live/chatlab.firstdataunion.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chatlab.firstdataunion.org/privkey.pem;

    # ChatLab application
    location /fidu-chat-lab {
        proxy_pass http://localhost:8118;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:8118/health;
        access_log off;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

#### 3. Enable site

```bash
sudo ln -s /etc/nginx/sites-available/chatlab /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. Get SSL Certificate

```bash
sudo certbot --nginx -d chatlab.firstdataunion.org
```

Certbot will automatically:
- Obtain SSL certificate from Let's Encrypt
- Configure nginx for HTTPS
- Set up certificate auto-renewal

---

## OpenBao Setup (Mode 1)

For production deployments with OpenBao:

### 1. Create OpenBao Policy

```bash
bao policy write chatlab-policy - <<EOF
path "secret/data/fidu/chatlab/*" {
  capabilities = ["read"]
}
path "secret/metadata/fidu/chatlab/*" {
  capabilities = ["read"]
}
path "sys/health" {
  capabilities = ["read"]
}
EOF
```

### 2. Create Token

```bash
bao token create \
  -policy=chatlab-policy \
  -ttl=720h \
  -renewable=true \
  -display-name="ChatLab Production"
```

### 3. Store Secrets

```bash
bao kv put secret/fidu/chatlab/prod \
  google_client_id="your-id.apps.googleusercontent.com" \
  google_client_secret="your-secret"
```

### 4. Configure Backend

Set server environment variables:

```bash
export OPENBAO_ENABLED=true
export OPENBAO_ADDRESS=https://openbao.yourcompany.com
export OPENBAO_TOKEN=hvs.your-token-here
export OPENBAO_SECRET_PATH=fidu/chatlab/prod
```

See [`OPENBAO_INTEGRATION.md`](OPENBAO_INTEGRATION.md) for complete setup guide.

---

## Monitoring & Health Checks

### Health Check Endpoint

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "service": "fidu-chat-lab",
  "environment": "prod",
  "timestamp": "2025-01-13T12:00:00",
  "metrics_enabled": true
}
```

### Metrics Endpoint

```bash
curl http://localhost:8080/fidu-chat-lab/api/metrics
```

Returns Prometheus-format metrics for:
- Request counts and latency
- OAuth operations
- Error rates
- Active users

### Log Locations

- **Application logs**: `/tmp/fidu-chat-lab.log`
- **Systemd logs**: `journalctl -u fidu-chat-lab-prod`
- **Nginx logs**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`

### Monitoring Best Practices

```bash
# Set up log rotation
sudo vim /etc/logrotate.d/chatlab

# Monitor service health (add to cron)
*/5 * * * * curl -f http://localhost:8118/health || systemctl restart fidu-chat-lab-prod

# Monitor disk space
df -h /usr/local/bin/fidu-chat-lab-prod
```

---

## Troubleshooting

### Deployment Issues

**Build fails**:
```bash
# Clear caches
npm cache clean --force
rm -rf node_modules package-lock.json dist/

# Reinstall and rebuild
npm install
npm run build

# Check environment file exists
ls -la .env.production
```

**Can't connect to server**:
```bash
# Test SSH
ssh root@YOUR_SERVER_IP

# Check firewall
sudo ufw status
sudo ufw allow 8118/tcp  # prod
sudo ufw allow 8119/tcp  # dev
```

### Service Issues

**Service won't start**:
```bash
# Check logs
sudo journalctl -u fidu-chat-lab-prod -n 50 --no-pager

# Check port availability
sudo netstat -tlnp | grep 8118

# Check file permissions
ls -la /usr/local/bin/fidu-chat-lab-prod

# Check Python dependencies
cd /usr/local/bin/fidu-chat-lab-prod
source venv/bin/activate
pip list
```

**Backend can't connect to OpenBao**:
```bash
# Test OpenBao connectivity
curl http://localhost:8200/v1/sys/health

# Check token validity
VAULT_TOKEN=your-token bao token lookup

# Verify secrets exist
VAULT_TOKEN=your-token bao kv get secret/fidu/chatlab/prod

# Check backend logs for details
tail -f /tmp/fidu-chat-lab.log
```

### Frontend Issues

**App loads but API calls fail**:
1. Check browser console for errors
2. Verify OAuth mode in console logs
3. Check Identity Service is accessible
4. Verify CORS settings on backend services

**OAuth not working**:
```bash
# Check frontend is using correct mode
# Browser console should show:
# ✅ "Token exchange via backend (secure)" - good
# ⚠️ "Backend not available" - check if intended

# Check Google OAuth credentials
curl http://localhost:8118/fidu-chat-lab/api/config

# Check backend logs
tail -f /tmp/fidu-chat-lab.log | grep OAuth
```

**Production misconfiguration warning**:
```
# If you see in production:
🚨 SECURITY WARNING: Using direct OAuth in production build!

# Fix: Remove VITE_GOOGLE_CLIENT_SECRET from production env
# Rebuild without the secret
npm run build
```

---

## Security Considerations

### ✅ Best Practices

1. **Use Mode 1 (OpenBao) in production**
   - Centralized secret management
   - Audit logging
   - Easy rotation

2. **Enable HTTPS**
   - Use nginx with SSL certificates
   - Redirect HTTP to HTTPS
   - Use strong cipher suites

3. **Restrict Access**
   - Use firewall rules
   - Limit SSH access
   - Use non-root service user

4. **Regular Updates**
   - Keep dependencies updated
   - Monitor security advisories
   - Rotate credentials regularly

5. **Monitor Logs**
   - Watch for security warnings
   - Track failed OAuth attempts
   - Monitor unusual access patterns

### ⚠️ Important Warnings

1. **Never deploy Mode 3** (frontend fallback) to production
2. **Never commit** `.env` files with real secrets
3. **Never expose** backend `/api/oauth/*` endpoints without HTTPS
4. **Always use** backend for OAuth in production
5. **Monitor for** production misconfiguration warnings

---

## Updating the App

### Quick Update

```bash
# Redeploy using script
cd src/apps/chat-lab
./deploy.sh prod YOUR_SERVER_IP
```

The script handles:
- Building latest version
- Stopping service
- Uploading new files
- Restarting service

### Manual Update

```bash
# 1. Build locally
npm run build

# 2. Upload to server
scp -r dist/ user@server:/usr/local/bin/fidu-chat-lab-prod/

# 3. Restart service
ssh user@server 'sudo systemctl restart fidu-chat-lab-prod'
```

### Zero-Downtime Update

For production, use rolling updates:

```bash
# 1. Deploy to new directory
./deploy.sh prod-new YOUR_SERVER_IP

# 2. Test new deployment
curl http://localhost:8120/health

# 3. Update nginx to point to new version
sudo vim /etc/nginx/sites-available/chatlab
sudo systemctl reload nginx

# 4. Stop old service
sudo systemctl stop fidu-chat-lab-prod-old
```

---

## Backup & Disaster Recovery

### What to Backup

1. **Environment configuration**
   ```bash
   cp /usr/local/bin/fidu-chat-lab-prod/.env ~/backups/
   ```

2. **Nginx configuration**
   ```bash
   cp /etc/nginx/sites-available/chatlab ~/backups/
   ```

3. **SSL certificates** (optional - Let's Encrypt can regenerate)

### Restore Procedure

1. Install prerequisites (Python, nginx, etc.)
2. Deploy application
3. Restore environment configuration
4. Restore nginx configuration
5. Get new SSL certificates or restore backed up ones
6. Start services

---

## Performance Optimization

### Frontend

- ✅ Production build minifies and optimizes automatically
- ✅ Vite creates optimal chunks
- ✅ Static assets have cache headers

### Backend

- Add caching headers for static files
- Enable gzip compression in nginx
- Use CDN for static assets (optional)

### nginx Configuration

```nginx
# Add to server block
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1000;

location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## Quick Reference

### Commands

```bash
# Local Development
npm run dev                    # Frontend only (Mode 3)
python backend/server.py       # Start backend locally

# Building
npm run build                  # Production build

# Deployment
./deploy.sh dev 46.62.134.169  # Deploy dev
./deploy.sh prod 46.62.134.169 # Deploy prod

# Service Management
sudo systemctl status fidu-chat-lab-prod
sudo journalctl -u fidu-chat-lab-prod -f
sudo systemctl restart fidu-chat-lab-prod

# Health Checks
curl http://localhost:8118/health
curl http://localhost:8118/fidu-chat-lab/api/metrics
```

### Ports

| Service | Port | Purpose |
|---------|------|---------|
| Dev Backend | 8119 | Development deployment |
| Prod Backend | 8118 | Production deployment |
| Frontend Dev | 3000 | Vite dev server (local only) |

### Key Files

| File | Purpose |
|------|---------|
| `backend/server.py` | FastAPI server |
| `backend/openbao_client.py` | OpenBao integration |
| `.env.development` | Dev environment config |
| `.env.production` | Prod build config |
| `deploy.sh` | Automated deployment script |

---

## Additional Resources

- **Backend Architecture**: [`backend/README.md`](backend/README.md)
- **OpenBao Setup**: [`OPENBAO_INTEGRATION.md`](OPENBAO_INTEGRATION.md)
- **Security Audit**: [`OAUTH_SECURITY_AUDIT.md`](OAUTH_SECURITY_AUDIT.md)
- **Project Organization**: [`PROJECT_ORGANIZATION.md`](PROJECT_ORGANIZATION.md)
- **Testing**: [`TESTING.md`](TESTING.md)

---

## Support

For deployment issues:

1. Check logs: `journalctl -u fidu-chat-lab-prod -f`
2. Check health: `curl http://localhost:8118/health`
3. Review this guide's troubleshooting section
4. Check backend logs: `tail -f /tmp/fidu-chat-lab.log`
5. Consult [`backend/README.md`](backend/README.md) for backend-specific issues
