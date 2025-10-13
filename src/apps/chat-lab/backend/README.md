# ChatLab Backend

This directory contains the Python backend service for FIDU ChatLab when deployed as a web application.

---

## 📋 Overview

The ChatLab backend is a **FastAPI service** that provides:
1. **Secure OAuth Token Exchange** - Keeps Google client secret server-side only
2. **Secret Management** - Fetches credentials from OpenBao or environment variables  
3. **Static File Serving** - Serves the built React frontend
4. **Metrics Collection** - Forwards metrics to VictoriaMetrics

---

## 🎯 When is the Backend Used?

The backend is **only needed for web-deployed mode**:

### ✅ Backend Required (Web Deployment)
- **Production deployments** on a server
- **Staging environments** accessible via web
- When you need **secure OAuth** (client secret on server)
- When you want **centralized secret management** (OpenBao)

### ❌ Backend NOT Required (Local Development)
- **Frontend-only development** with `npm run dev`
- Quick UI iterations
- Testing React components locally

The frontend **automatically detects** if backend is available and falls back to direct OAuth if not (see below).

---

## 🔐 How the OAuth Mechanism Works

### The Problem

Google OAuth requires a **client secret** to exchange authorization codes for tokens. Traditionally, web apps exposed this secret in the frontend, which is **insecure**:

```
❌ INSECURE (Old Way):
Frontend has secret → Calls Google directly → Secret exposed in browser
```

### Our Solution

We implement **backend token exchange** to keep the secret secure:

```
✅ SECURE (Our Way):
Frontend → Backend (has secret) → Google → Backend → Frontend (only tokens)
```

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                          │
│                                                                 │
│  1. User clicks "Connect Google Drive"                         │
│  2. Redirected to Google OAuth                                 │
│  3. Google redirects back with authorization code              │
│                              ↓                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ↓ (POST /api/oauth/exchange-code)
┌──────────────────────────────┼──────────────────────────────────┐
│                      ChatLab Backend (FastAPI)                  │
│                                                                 │
│  4. Receives authorization code from frontend                  │
│  5. Fetches client secret from OpenBao/env vars               │
│  6. Calls Google OAuth with code + secret (SERVER-SIDE)       │
│                              ↓                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ↓ (Token exchange)
┌──────────────────────────────┼──────────────────────────────────┐
│                     Google OAuth Servers                        │
│                                                                 │
│  7. Validates code + client ID + client secret                 │
│  8. Returns access token + refresh token                       │
│                              ↓                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ↓ (Returns tokens)
┌──────────────────────────────┼──────────────────────────────────┐
│                      ChatLab Backend                            │
│                                                                 │
│  9. Receives tokens from Google                                │
│ 10. Returns tokens to frontend (NO SECRET!)                    │
│                              ↓                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ↓
┌──────────────────────────────┼──────────────────────────────────┐
│                         User's Browser                          │
│                                                                 │
│ 11. Stores access/refresh tokens                              │
│ 12. Uses tokens to access Google Drive                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Security Points

1. **Client Secret Never Leaves Server**
   - Secret stored in OpenBao or backend environment variables
   - Frontend never sees or handles the secret
   - Cannot be extracted from browser DevTools

2. **Token Exchange is Server-Side Only**
   - Frontend sends only the authorization code
   - Backend adds the secret and calls Google
   - Frontend receives only the tokens

3. **Frontend Fallback for Development**
   - If backend unavailable, frontend can use direct OAuth
   - Requires `VITE_GOOGLE_CLIENT_SECRET` in dev environment
   - Production builds warn loudly if misconfigured

---

## 🗂️ Files in this Directory

### `server.py`
Main FastAPI application that:
- Serves the React frontend (`/fidu-chat-lab/*`)
- Provides OAuth endpoints (`/api/oauth/*`)
- Handles metrics collection (`/api/metrics`)
- Provides configuration API (`/api/config`)
- Health check endpoint (`/health`)

**Key Endpoints**:
- `GET /api/config` - Returns Google Client ID (public)
- `POST /api/oauth/exchange-code` - Exchanges auth code for tokens (secure)
- `POST /api/oauth/refresh-token` - Refreshes access tokens (secure)

### `openbao_client.py`
OpenBao integration client that:
- Connects to OpenBao vault
- Fetches Google OAuth credentials
- Falls back to environment variables
- Provides `ChatLabSecrets` dataclass

**Key Functions**:
- `load_chatlab_secrets_from_openbao()` - Load with fallback
- `OpenBaoClient` - Main client class
- `ChatLabSecrets` - Type-safe secrets container

### `__init__.py`
Package initialization file

---

## 🚀 Running the Backend

### Prerequisites

```bash
# Install dependencies
pip install -r ../../requirements.txt

# Or from project root
pip install hvac fastapi uvicorn httpx prometheus-client
```

### Configuration

Create `.env` file in the chat-lab directory:

```bash
# Development (without OpenBao)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
OPENBAO_ENABLED=false

# Production (with OpenBao)
OPENBAO_ENABLED=true
OPENBAO_ADDRESS=https://openbao.yourcompany.com
OPENBAO_TOKEN=hvs.your-token
OPENBAO_SECRET_PATH=fidu/chatlab/prod
```

### Starting the Server

```bash
# From chat-lab directory
cd /Users/oli/Documents/Programming/FIDU/src/apps/chat-lab

# Run the server
python backend/server.py

# Server starts on http://localhost:8080
# Frontend available at http://localhost:8080/fidu-chat-lab
```

### Development Workflow

**Option 1: Backend + Frontend (Recommended)**
```bash
# Terminal 1: Backend
python backend/server.py

# Terminal 2: Frontend dev server
npm run dev
```
Frontend will use secure backend OAuth endpoints.

**Option 2: Frontend Only (Quick iterations)**
```bash
# Just frontend
npm run dev
```
Frontend falls back to direct OAuth (requires `VITE_GOOGLE_CLIENT_SECRET`).

---

## 🔐 Secret Management

### OpenBao (Production)

The backend integrates with OpenBao for centralized secret management:

**1. Store Secrets**:
```bash
bao kv put secret/fidu/chatlab/prod \
  google_client_id="your-id.apps.googleusercontent.com" \
  google_client_secret="your-secret"
```

**2. Configure Backend**:
```bash
OPENBAO_ENABLED=true
OPENBAO_ADDRESS=https://openbao.yourcompany.com:8200
OPENBAO_TOKEN=hvs.your-token
OPENBAO_SECRET_PATH=fidu/chatlab/prod
```

**3. Backend Automatically**:
- Connects to OpenBao at startup
- Fetches secrets
- Falls back to env vars if OpenBao unavailable
- Logs success/failure

### Environment Variables (Development/Fallback)

If OpenBao is disabled or unreachable:

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret
```

Backend loads these as fallback.

---

## 📊 Why This Architecture?

### Security Benefits

1. **OAuth 2.0 Compliant**
   - Follows "Confidential Client" pattern
   - Client secret never exposed to public clients
   - Industry standard for web applications

2. **Defense in Depth**
   - Secrets in OpenBao (encrypted, audited)
   - Fallback to environment variables (server-side only)
   - Frontend fallback for development (with warnings)
   - Production misconfiguration protection

3. **Audit Trail**
   - OpenBao logs all secret access
   - Backend logs OAuth operations
   - Easy to track who accessed what

### Operational Benefits

1. **Secret Rotation Without Redeployment**
   - Update secret in OpenBao
   - Restart backend service
   - No code changes needed

2. **Consistent Across Services**
   - Same pattern as Go services
   - Centralized secret management
   - One place to rotate credentials

3. **Graceful Degradation**
   - OpenBao down? Use env vars
   - Backend down? Frontend fallback (dev only)
   - No single point of failure

### Developer Experience

1. **Flexible Development**
   - Backend available? Use secure mode
   - Backend not available? Use direct OAuth
   - Clear error messages for misconfigurations

2. **Easy Testing**
   - Frontend-only: `npm run dev`
   - Full stack: `python backend/server.py` + `npm run dev`
   - Production-like: Backend with OpenBao

3. **Clear Separation**
   - Backend handles secrets
   - Frontend handles UI
   - Well-defined API contract

---

## 🧪 Testing

### Test OAuth Flow

```bash
# 1. Start backend
python backend/server.py

# 2. Check health
curl http://localhost:8080/health

# 3. Check config endpoint
curl http://localhost:8080/fidu-chat-lab/api/config

# 4. Test OAuth (requires auth code from Google)
curl -X POST http://localhost:8080/fidu-chat-lab/api/oauth/exchange-code \
  -H "Content-Type: application/json" \
  -d '{"code": "test_code", "redirect_uri": "http://localhost:3000/oauth-callback"}'
```

### Test OpenBao Integration

```bash
# Set OpenBao config
export OPENBAO_ENABLED=true
export OPENBAO_ADDRESS=http://localhost:8200
export OPENBAO_TOKEN=hvs.your-token

# Start server - should fetch from OpenBao
python backend/server.py

# Check logs for:
# ✅ OpenBao connection successful
# ✅ Secrets loaded from OpenBao
```

---

## 📝 Deployment

### Production Deployment

```bash
# 1. Build frontend
npm run build

# 2. Set production environment variables
export OPENBAO_ENABLED=true
export OPENBAO_ADDRESS=https://openbao.yourcompany.com
export OPENBAO_TOKEN=hvs.production-token
export OPENBAO_SECRET_PATH=fidu/chatlab/prod
export ENVIRONMENT=prod

# 3. Start backend (serves frontend)
python backend/server.py

# 4. Backend serves:
# - Frontend: http://yourserver.com/fidu-chat-lab
# - Health: http://yourserver.com/health
# - Metrics: http://yourserver.com/fidu-chat-lab/api/metrics
```

### With Process Manager (Recommended)

```bash
# Using systemd
sudo systemctl start chatlab-backend

# Using supervisor
supervisorctl start chatlab-backend

# Using PM2 (for Node.js/Python)
pm2 start backend/server.py --interpreter python3 --name chatlab-backend
```

---

## 🔍 Monitoring

### Health Check

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "service": "fidu-chat-lab",
  "environment": "prod",
  "timestamp": "2025-01-13T10:30:00",
  "metrics_enabled": true
}
```

### Logs

Backend logs to:
- Console (stdout/stderr)
- `/tmp/fidu-chat-lab.log`

Look for:
```
✅ OpenBao connection successful
✅ Secrets loaded from OpenBao
✅ OAuth token exchange successful
⚠️  OpenBao connection test failed, falling back to environment variables
```

### Metrics

Metrics exported in Prometheus format:
```bash
curl http://localhost:8080/fidu-chat-lab/api/metrics
```

Forwarded to VictoriaMetrics if configured.

---

## 🐛 Troubleshooting

### Backend Won't Start

**Check**:
```bash
# Python version
python --version  # Should be 3.8+

# Dependencies installed
pip list | grep fastapi
pip list | grep hvac

# Port available
lsof -i :8080
```

### OpenBao Connection Failed

**Check**:
```bash
# OpenBao is accessible
curl http://localhost:8200/v1/sys/health

# Token is valid
VAULT_TOKEN=your-token bao token lookup

# Path has secrets
VAULT_TOKEN=your-token bao kv get secret/fidu/chatlab/prod
```

### Frontend Can't Connect

**Check**:
```bash
# Backend is running
ps aux | grep "python.*server.py"

# Port is correct
curl http://localhost:8080/health

# CORS not blocking (if frontend on different port)
# Check browser console for CORS errors
```

### OAuth Not Working

**Check**:
```bash
# Client secret is configured
curl http://localhost:8080/fidu-chat-lab/api/config

# Backend logs show OAuth attempts
tail -f /tmp/fidu-chat-lab.log

# Google OAuth credentials are correct
# Verify in Google Cloud Console
```

---

## 📚 Related Documentation

- `../OPENBAO_INTEGRATION.md` - OpenBao setup guide
- `../OAUTH_SECURITY_AUDIT.md` - Security analysis
- `../DEPLOYMENT.md` - Deployment guide with all modes
- `../IMPLEMENTATION_SUMMARY.md` - Complete implementation overview

---

## 🤝 Contributing

When modifying the backend:

1. **Test locally** with both OpenBao and env vars
2. **Run linters**: `pylint backend/*.py`
3. **Update tests** if changing OAuth logic
4. **Document changes** in this README
5. **Test deployment** in staging before production

---

## 📜 License

Part of the FIDU project. See main LICENSE file.

