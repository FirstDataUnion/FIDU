# FIDU Chat Lab - Deployment Guide

## Overview

The Chat Lab app is deployed as a statically-built React application served by a lightweight FastAPI server. This approach:

- ✅ **Simple**: Minimal server-side dependencies (just Python + FastAPI)
- ✅ **Fast**: Serves pre-built static files
- ✅ **Reliable**: No complex runtime compilation
- ✅ **Consistent**: Same serving pattern as your local FIDU Vault app

## Prerequisites

1. **Node.js and npm** installed locally (for building)
2. **SSH access** to your deployment server
3. **Python 3** installed on the server
4. **Environment files** configured:
   - `.env.development` for dev environment
   - `.env.production` for prod environment

## Environment Configuration

Your environment files should contain:

```bash
# .env.development (for dev deployments)
VITE_IDENTITY_SERVICE_URL=https://dev.identity.firstdataunion.org
VITE_GATEWAY_URL=https://dev.gateway.firstdataunion.org
VITE_STORAGE_MODE=cloud
VITE_SYNC_INTERVAL=300000
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_CLIENT_SECRET=your-client-secret
# Email allowlist - restricts access to these emails only
VITE_ALLOWED_EMAILS=team-member1@company.com,team-member2@company.com

# .env.production (for prod deployments)
VITE_IDENTITY_SERVICE_URL=https://identity.firstdataunion.org
VITE_GATEWAY_URL=https://gateway.firstdataunion.org
VITE_STORAGE_MODE=cloud
VITE_SYNC_INTERVAL=300000
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_CLIENT_SECRET=your-client-secret
# Leave empty in production - access controlled by subscription system
VITE_ALLOWED_EMAILS=
```

**Note**: These variables are baked into the build at compile time, not runtime.

### Email Allowlist (Development Only)

The `VITE_ALLOWED_EMAILS` variable restricts access to the development environment:

- **Development**: Only listed emails can log in
- **Production**: All authenticated users can log in (variable is ignored)
- **Format**: Comma-separated email addresses
- **Example**: `alice@company.com,bob@company.com,charlie@company.com`

See `EMAIL-ALLOWLIST.md` for complete documentation.

## Deployment Steps

### Deploy to Development

```bash
cd src/apps/chat-lab
./deploy.sh dev YOUR_SERVER_IP
```

**Example:**
```bash
./deploy.sh dev 46.62.134.169
```

This will:
1. Build the React app with `.env.development` settings
2. Create a deployment package with a FastAPI server
3. Upload everything to `/usr/local/bin/fidu-chat-lab-dev` on the server
4. Set up a systemd service (`fidu-chat-lab-dev`)
5. Start the service on port **8119**

### Deploy to Production

```bash
cd src/apps/chat-lab
./deploy.sh prod YOUR_SERVER_IP
```

**Example:**
```bash
./deploy.sh prod 46.62.134.169
```

This will:
1. Build the React app with `.env.production` settings
2. Create a deployment package with a FastAPI server
3. Upload everything to `/usr/local/bin/fidu-chat-lab-prod` on the server
4. Set up a systemd service (`fidu-chat-lab-prod`)
5. Start the service on port **8118**

## Server Configuration

### Deployment Paths

- **Dev**: `/usr/local/bin/fidu-chat-lab-dev` (port 8119)
- **Prod**: `/usr/local/bin/fidu-chat-lab-prod` (port 8118)

### URLs

- **Dev**: `http://dev.chatlab.firstdataunion.org:8119/fidu-chat-lab`
- **Prod**: `http://chatlab.firstdataunion.org:8118/fidu-chat-lab`

### Service Management

```bash
# Check status
sudo systemctl status fidu-chat-lab-dev
sudo systemctl status fidu-chat-lab-prod

# View logs
sudo journalctl -u fidu-chat-lab-dev -f
sudo journalctl -u fidu-chat-lab-prod -f

# Restart
sudo systemctl restart fidu-chat-lab-dev
sudo systemctl restart fidu-chat-lab-prod

# Stop
sudo systemctl stop fidu-chat-lab-dev
sudo systemctl stop fidu-chat-lab-prod
```

## Architecture

### How It Works

1. **Build Time**: 
   - Vite builds the React app with environment variables
   - Creates optimized static files in `dist/`
   - All API endpoints and configs are baked in

2. **Server Side**:
   - FastAPI server serves the static files
   - Routes `/fidu-chat-lab` → serves `index.html`
   - Routes `/fidu-chat-lab/*` → serves static assets or falls back to `index.html` (for client-side routing)
   - Health check at `/health`

3. **Runtime**:
   - Systemd manages the process
   - Service auto-restarts on failure
   - Runs as dedicated user for security

### Directory Structure on Server

```
/usr/local/bin/fidu-chat-lab-{env}/
├── dist/                 # Built React app
│   ├── index.html
│   └── assets/
├── venv/                 # Python virtual environment
├── server.py            # FastAPI server
├── requirements.txt     # Python dependencies
├── .env                 # Environment-specific config
└── install.sh           # Installation script
```

## Adding SSL/HTTPS (Recommended for Production)

For production, you should add nginx as a reverse proxy with SSL:

### Install nginx and Certbot

```bash
sudo apt-get update
sudo apt-get install nginx certbot python3-certbot-nginx
```

### Configure nginx

Create `/etc/nginx/sites-available/chatlab`:

```nginx
server {
    listen 80;
    server_name chatlab.firstdataunion.org;

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

    location /health {
        proxy_pass http://localhost:8118/health;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/chatlab /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Add SSL Certificate

```bash
sudo certbot --nginx -d chatlab.firstdataunion.org
```

Certbot will automatically:
- Obtain SSL certificate
- Configure nginx for HTTPS
- Set up auto-renewal

## Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u fidu-chat-lab-dev -n 50

# Check if port is in use
sudo netstat -tlnp | grep 8119

# Check file permissions
ls -la /usr/local/bin/fidu-chat-lab-dev
```

### Build fails

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check environment file exists
ls -la .env.development .env.production
```

### Can't connect to server

```bash
# Test SSH connection
ssh root@YOUR_SERVER_IP

# Check firewall
sudo ufw status

# Allow port if needed
sudo ufw allow 8119/tcp

# Make sure you provided the server IP as argument
./deploy.sh dev YOUR_SERVER_IP
```

### App loads but API calls fail

1. Check browser console for errors
2. Verify environment variables in the build:
   - Open browser dev tools → Network tab
   - Check which URLs are being called
3. Verify the identity service is accessible from client browser
4. Check CORS settings on the gateway/identity service

## Quick Reference

### Deploy Commands

```bash
# Development
./deploy.sh dev YOUR_SERVER_IP

# Production  
./deploy.sh prod YOUR_SERVER_IP

# Example
./deploy.sh dev 46.62.134.169
./deploy.sh prod 46.62.134.169
```

### Server Commands (run on server)

```bash
# Status
sudo systemctl status fidu-chat-lab-{dev|prod}

# Logs (live)
sudo journalctl -u fidu-chat-lab-{dev|prod} -f

# Restart
sudo systemctl restart fidu-chat-lab-{dev|prod}

# Health check
curl http://localhost:{8119|8118}/health
```

### URLs

| Environment | Port | URL |
|------------|------|-----|
| Dev | 8119 | http://dev.chatlab.firstdataunion.org:8119/fidu-chat-lab |
| Prod | 8118 | http://chatlab.firstdataunion.org:8118/fidu-chat-lab |

## Maintenance

### Updating the App

Just re-run the deployment script:

```bash
./deploy.sh dev YOUR_SERVER_IP   # or prod YOUR_SERVER_IP
```

The script will:
1. Build the latest version
2. Stop the existing service
3. Upload new files
4. Restart the service

### Monitoring

Set up basic monitoring:

```bash
# Add to crontab (run `crontab -e`)
*/5 * * * * curl -f http://localhost:8119/health || systemctl restart fidu-chat-lab-dev
```

### Backups

There's no database or user data on the server (it's all static files), so backups aren't critical. However, you may want to backup:

- Environment files
- nginx configuration
- SSL certificates (though Let's Encrypt can regenerate)

## Security Considerations

- ✅ Service runs as dedicated non-root user
- ✅ Systemd security restrictions applied
- ✅ Consider adding rate limiting in nginx
- ✅ Use HTTPS in production
- ⚠️  Currently allows CORS from all origins (consider restricting in production)
- ⚠️  Google client secrets are in environment files (consider using a secrets manager)

## Future Improvements

1. **Container Deployment**: Consider Docker/Podman for easier deployment
2. **CDN**: Use a CDN for static assets to reduce server load
3. **Monitoring**: Add proper monitoring (Prometheus, Grafana, etc.)
4. **CI/CD**: Automate deployments via GitHub Actions
5. **Multiple Regions**: Deploy to multiple regions for redundancy

