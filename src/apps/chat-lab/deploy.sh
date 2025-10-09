#!/bin/bash
# deploy.sh - Deploy FIDU Chat Lab to remote server

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Parse command line arguments
ENVIRONMENT=${1:-dev}  # Default to dev if no argument provided
SERVER_IP=${2:-""}     # Server IP as second argument

# Validate environment argument
case $ENVIRONMENT in
    "prod"|"production")
        ENVIRONMENT="prod"
        DEPLOY_PATH="/usr/local/bin/fidu-chat-lab-prod"
        PORT=8118
        SERVICE_NAME="fidu-chat-lab-prod"
        DOMAIN="chatlab.firstdataunion.org"
        ENV_FILE=".env.production"
        ;;
    "dev"|"development")
        ENVIRONMENT="dev"
        DEPLOY_PATH="/usr/local/bin/fidu-chat-lab-dev"
        PORT=8119
        SERVICE_NAME="fidu-chat-lab-dev"
        DOMAIN="dev.chatlab.firstdataunion.org"
        ENV_FILE=".env.development"
        ;;
    *)
        echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
        echo "Usage: $0 [prod|dev] [server_ip]"
        echo "  prod       - Deploy to production environment"
        echo "  dev        - Deploy to development environment"
        echo "  server_ip  - IP address of the deployment server"
        echo ""
        echo "Example: $0 dev 46.62.134.169"
        exit 1
        ;;
esac

SERVER_USER="root"
SSH_KEY_PATH=""  # Path to your private SSH key (e.g., ~/.ssh/id_rsa) - Leave empty to use ssh-agent
LOCAL_BUILD_DIR="./build-deploy-${ENVIRONMENT}"

# Capitalize first letter of environment name
ENVIRONMENT_CAPITALIZED=$(echo "$ENVIRONMENT" | sed 's/^./\U&/')
echo -e "${GREEN}🚀 FIDU Chat Lab - ${ENVIRONMENT_CAPITALIZED} Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Deploy Path: ${DEPLOY_PATH}${NC}"
echo -e "${BLUE}Port: ${PORT}${NC}"
echo -e "${BLUE}Service: ${SERVICE_NAME}${NC}"
echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
echo -e "${BLUE}Env File: ${ENV_FILE}${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to build SSH command with key if provided
build_ssh_cmd() {
    # Expand tilde to home directory if present
    if [[ "$SSH_KEY_PATH" == ~* ]]; then
        EXPANDED_SSH_KEY_PATH="${SSH_KEY_PATH/#\~/$HOME}"
    else
        EXPANDED_SSH_KEY_PATH="$SSH_KEY_PATH"
    fi
    
    if [ -n "$SSH_KEY_PATH" ] && [ -f "$EXPANDED_SSH_KEY_PATH" ]; then
        echo "ssh -i \"$EXPANDED_SSH_KEY_PATH\" -o ConnectTimeout=10"
    else
        echo "ssh -o ConnectTimeout=10"
    fi
}

# Function to prompt for server details if not set
check_server_config() {
    if [[ -z "$SERVER_IP" ]]; then
        echo -e "${YELLOW}📋 Server IP not configured${NC}"
        read -p "Enter server IP address: " SERVER_IP
        if [[ -z "$SERVER_IP" ]]; then
            echo -e "${RED}❌ Server IP is required${NC}"
            exit 1
        fi
    fi

    if [[ -z "$SERVER_USER" ]]; then
        echo -e "${YELLOW}📋 SSH username not configured${NC}"
        read -p "Enter SSH username: " SERVER_USER
        if [[ -z "$SERVER_USER" ]]; then
            echo -e "${RED}❌ SSH username is required${NC}"
            exit 1
        fi
    fi

    echo -e "${BLUE}Server: ${SERVER_USER}@${SERVER_IP}:${DEPLOY_PATH}${NC}"
    echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
    if [[ -n "$SSH_KEY_PATH" ]]; then
        echo -e "${BLUE}SSH Key: ${SSH_KEY_PATH}${NC}"
    else
        echo -e "${BLUE}SSH Key: Using default SSH agent${NC}"
    fi
    echo ""
}

# Check server configuration
check_server_config

# Check dependencies
echo -e "${YELLOW}📋 Checking dependencies...${NC}"
if ! command_exists node; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm not found. Please install npm${NC}"
    exit 1
fi

if ! command_exists ssh; then
    echo -e "${RED}❌ SSH not found. Please install SSH client${NC}"
    exit 1
fi

if ! command_exists rsync; then
    echo -e "${RED}❌ rsync not found. Please install rsync${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All dependencies found${NC}"

# Clean and create build directory
echo -e "${YELLOW}🧹 Cleaning build directory...${NC}"
rm -rf "$LOCAL_BUILD_DIR"
mkdir -p "$LOCAL_BUILD_DIR"

# Step 1: Check for environment file
echo -e "${YELLOW}📋 Checking for environment file...${NC}"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment file not found: $ENV_FILE${NC}"
    echo "Please create $ENV_FILE with the necessary configuration."
    exit 1
fi
echo -e "${GREEN}✅ Found environment file: $ENV_FILE${NC}"

# Step 2: Build the React app
echo -e "${YELLOW}🔨 Building React application...${NC}"

# Copy environment file to .env for Vite to pick up
cp "$ENV_FILE" .env

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing npm dependencies...${NC}"
    npm install
fi

# Build the app with environment variables
echo -e "${BLUE}🏗️  Building production bundle...${NC}"
# Load environment variables from .env file and pass them to the build
export $(cat .env | grep -v '^#' | xargs)
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed! dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful!${NC}"

# Step 3: Copy files to local build directory
echo -e "${YELLOW}📂 Preparing deployment files...${NC}"

# Copy the built dist folder
cp -r dist "$LOCAL_BUILD_DIR/"

# Copy environment file
cp "$ENV_FILE" "$LOCAL_BUILD_DIR/.env"

# Copy the Python server file
echo -e "${BLUE}📄 Copying server.py...${NC}"
cp server.py "$LOCAL_BUILD_DIR/server.py"

# Create requirements.txt
cat > "$LOCAL_BUILD_DIR/requirements.txt" << EOF
fastapi==0.115.6
uvicorn[standard]==0.34.0
httpx==0.28.1
prometheus-client==0.21.0
EOF

# Create systemd service file
cat > "$LOCAL_BUILD_DIR/${SERVICE_NAME}.service" << EOF
[Unit]
Description=FIDU Chat Lab (${ENVIRONMENT})
After=network.target

[Service]
Type=simple
User=fidu-chat-lab-${ENVIRONMENT}
Group=fidu-chat-lab-${ENVIRONMENT}
WorkingDirectory=${DEPLOY_PATH}
ExecStart=${DEPLOY_PATH}/venv/bin/python ${DEPLOY_PATH}/server.py
Restart=always
RestartSec=5
Environment=PORT=${PORT}
Environment=ENVIRONMENT=${ENVIRONMENT}

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DEPLOY_PATH}

[Install]
WantedBy=multi-user.target
EOF

# Create installation script for the server
cat > "$LOCAL_BUILD_DIR/install.sh" << EOF
#!/bin/bash
# Server-side installation script

set -e

echo "🔧 Setting up FIDU Chat Lab (${ENVIRONMENT})..."

# Install Python if not present
if ! command -v python3 &> /dev/null; then
    echo "📦 Installing Python3..."
    apt-get update
    apt-get install -y python3 python3-pip python3-venv
fi

# Create user if not exists
if ! id "fidu-chat-lab-${ENVIRONMENT}" &>/dev/null; then
    useradd -r -s /bin/false fidu-chat-lab-${ENVIRONMENT}
    echo "✅ Created fidu-chat-lab-${ENVIRONMENT} user"
fi

# Create and activate virtual environment
echo "🐍 Setting up Python virtual environment..."
cd ${DEPLOY_PATH}
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Set permissions
chown -R fidu-chat-lab-${ENVIRONMENT}:fidu-chat-lab-${ENVIRONMENT} ${DEPLOY_PATH}
chmod +x ${DEPLOY_PATH}/server.py

# Install systemd service
if [ -f ${DEPLOY_PATH}/${SERVICE_NAME}.service ]; then
    cp ${DEPLOY_PATH}/${SERVICE_NAME}.service /etc/systemd/system/${SERVICE_NAME}.service
    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME}
    echo "✅ Systemd service installed as ${SERVICE_NAME}"
fi

# Create firewall rules (if ufw is installed)
if command -v ufw >/dev/null 2>&1; then
    ufw allow ${PORT}/tcp 2>/dev/null || true
    echo "✅ Firewall rules added for port ${PORT}"
fi

echo "🚀 Installation complete!"
echo ""
echo "To start the service:"
echo "  sudo systemctl start ${SERVICE_NAME}"
echo ""
echo "To check status:"
echo "  sudo systemctl status ${SERVICE_NAME}"
echo ""
echo "To view logs:"
echo "  sudo journalctl -u ${SERVICE_NAME} -f"
echo ""
echo "Access the application at: http://${DOMAIN}:${PORT}/fidu-chat-lab"
EOF

chmod +x "$LOCAL_BUILD_DIR/install.sh"

# Create README
cat > "$LOCAL_BUILD_DIR/README.md" << EOF
# FIDU Chat Lab - ${ENVIRONMENT_CAPITALIZED} Deployment

## Quick Start

1. Run the installation script:
   \`\`\`bash
   sudo ./install.sh
   \`\`\`

2. Start the service:
   \`\`\`bash
   sudo systemctl start ${SERVICE_NAME}
   \`\`\`

3. Access the application:
   - URL: http://${DOMAIN}:${PORT}/fidu-chat-lab
   - Health Check: http://${DOMAIN}:${PORT}/health

## Manual Setup

If you prefer not to use the installation script:

1. Create a Python virtual environment:
   \`\`\`bash
   python3 -m venv venv
   source venv/bin/activate
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

3. Run the server:
   \`\`\`bash
   python server.py
   \`\`\`

## Environment Variables

The following environment variables are baked into the build:
- VITE_IDENTITY_SERVICE_URL
- VITE_GATEWAY_URL
- VITE_STORAGE_MODE
- VITE_SYNC_INTERVAL
- VITE_GOOGLE_CLIENT_ID
- VITE_GOOGLE_CLIENT_SECRET

These are set at build time from ${ENV_FILE}.

## Systemd Service

The service is configured to:
- Run as user: fidu-chat-lab-${ENVIRONMENT}
- Listen on port: ${PORT}
- Auto-restart on failure
- Start on boot

Commands:
- Start: \`sudo systemctl start ${SERVICE_NAME}\`
- Stop: \`sudo systemctl stop ${SERVICE_NAME}\`
- Restart: \`sudo systemctl restart ${SERVICE_NAME}\`
- Status: \`sudo systemctl status ${SERVICE_NAME}\`
- Logs: \`sudo journalctl -u ${SERVICE_NAME} -f\`

## Nginx Reverse Proxy (Optional)

For production, consider adding nginx as a reverse proxy with SSL:

\`\`\`nginx
server {
    listen 80;
    server_name ${DOMAIN};
    
    location /fidu-chat-lab {
        proxy_pass http://localhost:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
\`\`\`

## Troubleshooting

- Check logs: \`sudo journalctl -u ${SERVICE_NAME} -f\`
- Verify port is listening: \`sudo netstat -tlnp | grep ${PORT}\`
- Test health endpoint: \`curl http://localhost:${PORT}/health\`
- Check file permissions: Files should be owned by fidu-chat-lab-${ENVIRONMENT}
EOF

echo -e "${GREEN}✅ Build complete! Files prepared in: $LOCAL_BUILD_DIR${NC}"

# Step 4: Upload to server
echo -e "${YELLOW}🌐 Uploading to server ${SERVER_IP}...${NC}"

# Build SSH command
SSH_CMD=$(build_ssh_cmd)

# Test SSH connection
echo -e "${BLUE}🔍 Testing SSH connection...${NC}"
if ! $SSH_CMD "$SERVER_USER@$SERVER_IP" exit 2>/dev/null; then
    echo -e "${RED}❌ Cannot connect to server. Please check:${NC}"
    echo "  - Server IP: $SERVER_IP"
    echo "  - SSH user: $SERVER_USER"
    if [[ -n "$SSH_KEY_PATH" ]]; then
        echo "  - SSH key: $SSH_KEY_PATH"
    else
        echo "  - SSH key authentication is set up"
    fi
    echo ""
    echo "Try: $SSH_CMD $SERVER_USER@$SERVER_IP"
    exit 1
fi

echo -e "${GREEN}✅ SSH connection successful${NC}"

# Create deployment directory on server
echo -e "${YELLOW}📁 Creating deployment directory on server...${NC}"
$SSH_CMD "$SERVER_USER@$SERVER_IP" "mkdir -p $DEPLOY_PATH"

# Stop existing service if running
echo -e "${YELLOW}🛑 Stopping existing service (if running)...${NC}"
$SSH_CMD "$SERVER_USER@$SERVER_IP" "systemctl stop ${SERVICE_NAME} 2>/dev/null || true"

# Upload files
echo -e "${YELLOW}📤 Uploading files...${NC}"
if [[ "$SSH_KEY_PATH" == ~* ]]; then
    EXPANDED_SSH_KEY_PATH="${SSH_KEY_PATH/#\~/$HOME}"
else
    EXPANDED_SSH_KEY_PATH="$SSH_KEY_PATH"
fi

if [ -n "$SSH_KEY_PATH" ] && [ -f "$EXPANDED_SSH_KEY_PATH" ]; then
    rsync -avz --progress -e "ssh -i \"$EXPANDED_SSH_KEY_PATH\"" "$LOCAL_BUILD_DIR/" "$SERVER_USER@$SERVER_IP:$DEPLOY_PATH/"
else
    rsync -avz --progress "$LOCAL_BUILD_DIR/" "$SERVER_USER@$SERVER_IP:$DEPLOY_PATH/"
fi

# Run installation script on server
echo -e "${YELLOW}⚙️  Running installation script on server...${NC}"
$SSH_CMD "$SERVER_USER@$SERVER_IP" "cd $DEPLOY_PATH && chmod +x install.sh && ./install.sh"

# Start the service
echo -e "${YELLOW}🚀 Starting service...${NC}"
$SSH_CMD "$SERVER_USER@$SERVER_IP" "systemctl start ${SERVICE_NAME}"

# Check service status
echo -e "${YELLOW}📊 Checking service status...${NC}"
$SSH_CMD "$SERVER_USER@$SERVER_IP" "systemctl status ${SERVICE_NAME} --no-pager" || true

# Test the health endpoint
echo -e "${YELLOW}🏥 Testing health endpoint...${NC}"
sleep 2  # Give the service a moment to start
$SSH_CMD "$SERVER_USER@$SERVER_IP" "curl -f http://localhost:${PORT}/health" || echo -e "${YELLOW}⚠️  Health check failed (service may still be starting)${NC}"

echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo "  Server: $SERVER_USER@$SERVER_IP"
echo "  Path: $DEPLOY_PATH"
echo "  Port: $PORT"
echo "  Health Check: http://${DOMAIN}:${PORT}/health"
echo "  App URL: http://${DOMAIN}:${PORT}/fidu-chat-lab"
echo ""
echo -e "${BLUE}📝 Useful Commands:${NC}"
if [ -n "$SSH_KEY_PATH" ]; then
    echo "  Check status: ssh -i \"$SSH_KEY_PATH\" $SERVER_USER@$SERVER_IP 'systemctl status ${SERVICE_NAME}'"
    echo "  View logs: ssh -i \"$SSH_KEY_PATH\" $SERVER_USER@$SERVER_IP 'journalctl -u ${SERVICE_NAME} -f'"
    echo "  Restart: ssh -i \"$SSH_KEY_PATH\" $SERVER_USER@$SERVER_IP 'systemctl restart ${SERVICE_NAME}'"
else
    echo "  Check status: ssh $SERVER_USER@$SERVER_IP 'systemctl status ${SERVICE_NAME}'"
    echo "  View logs: ssh $SERVER_USER@$SERVER_IP 'journalctl -u ${SERVICE_NAME} -f'"
    echo "  Restart: ssh $SERVER_USER@$SERVER_IP 'systemctl restart ${SERVICE_NAME}'"
fi
echo ""
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "  - Test the application at http://${DOMAIN}:${PORT}/fidu-chat-lab"
echo "  - Consider setting up nginx as a reverse proxy with SSL"
echo "  - Update your DNS if using a custom domain"
echo "  - Set up monitoring and log rotation"

# Clean up
echo -e "${YELLOW}🧹 Cleaning up local build directory...${NC}"
rm -rf "$LOCAL_BUILD_DIR"
rm -f .env  # Remove the copied .env file

echo -e "${GREEN}✅ Done!${NC}"
