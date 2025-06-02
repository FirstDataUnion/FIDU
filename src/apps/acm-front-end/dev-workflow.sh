#!/bin/bash

# ACM Development Workflow Script
# This script helps with common development tasks for the ACM front-end

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIDU_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

echo -e "${BLUE}🤖 ACM Development Workflow${NC}"
echo -e "${BLUE}============================${NC}"

case "$1" in
    "install"|"i")
        echo -e "${YELLOW}📦 Installing dependencies...${NC}"
        cd "$SCRIPT_DIR"
        npm install
        echo -e "${GREEN}✅ Dependencies installed!${NC}"
        ;;
    
    "dev"|"d")
        echo -e "${YELLOW}🚀 Starting development server...${NC}"
        cd "$SCRIPT_DIR"
        npm run dev
        ;;
    
    "build"|"b")
        echo -e "${YELLOW}🏗️ Building for production...${NC}"
        cd "$SCRIPT_DIR"
        npm run build
        echo -e "${GREEN}✅ Build complete!${NC}"
        ;;
    
    "preview"|"p")
        echo -e "${YELLOW}👀 Starting preview server...${NC}"
        cd "$SCRIPT_DIR"
        npm run preview
        ;;
    
    "status"|"s")
        echo -e "${YELLOW}📊 Git status...${NC}"
        cd "$FIDU_ROOT"
        git status
        ;;
    
    "add"|"a")
        echo -e "${YELLOW}➕ Adding ACM changes to git...${NC}"
        cd "$FIDU_ROOT"
        git add src/apps/acm-front-end/
        echo -e "${GREEN}✅ ACM changes staged!${NC}"
        ;;
    
    "commit"|"c")
        if [ -z "$2" ]; then
            echo -e "${RED}❌ Please provide a commit message: ./dev-workflow.sh commit 'Your message'${NC}"
            exit 1
        fi
        echo -e "${YELLOW}💾 Committing changes...${NC}"
        cd "$FIDU_ROOT"
        git add src/apps/acm-front-end/
        git commit -m "ACM: $2"
        echo -e "${GREEN}✅ Changes committed!${NC}"
        ;;
    
    "push")
        echo -e "${YELLOW}📤 Pushing to FIDU repository...${NC}"
        cd "$FIDU_ROOT"
        git push origin main
        echo -e "${GREEN}✅ Pushed to FIDU repository!${NC}"
        ;;
    
    "pull")
        echo -e "${YELLOW}📥 Pulling from FIDU repository...${NC}"
        cd "$FIDU_ROOT"
        git pull origin main
        echo -e "${GREEN}✅ Pulled from FIDU repository!${NC}"
        ;;
    
    "sync")
        echo -e "${YELLOW}🔄 Syncing with FIDU repository...${NC}"
        cd "$FIDU_ROOT"
        git add src/apps/acm-front-end/
        if [ -n "$(git diff --staged)" ]; then
            git commit -m "ACM: Auto-sync changes"
        fi
        git pull origin main
        git push origin main
        echo -e "${GREEN}✅ Synced with FIDU repository!${NC}"
        ;;
    
    "clean")
        echo -e "${YELLOW}🧹 Cleaning node_modules and rebuilding...${NC}"
        cd "$SCRIPT_DIR"
        rm -rf node_modules package-lock.json
        npm install
        echo -e "${GREEN}✅ Clean install complete!${NC}"
        ;;
    
    "test"|"t")
        echo -e "${YELLOW}🧪 Running tests...${NC}"
        cd "$SCRIPT_DIR"
        if [ -f "package.json" ] && grep -q '"test"' package.json; then
            npm test
        else
            echo -e "${YELLOW}⚠️ No tests configured yet${NC}"
        fi
        ;;
    
    "help"|"h"|*)
        echo -e "${GREEN}Available commands:${NC}"
        echo -e "  ${BLUE}install${NC} | ${BLUE}i${NC}        Install dependencies"
        echo -e "  ${BLUE}dev${NC}     | ${BLUE}d${NC}        Start development server"
        echo -e "  ${BLUE}build${NC}   | ${BLUE}b${NC}        Build for production"
        echo -e "  ${BLUE}preview${NC} | ${BLUE}p${NC}        Start preview server"
        echo -e "  ${BLUE}status${NC}  | ${BLUE}s${NC}        Show git status"
        echo -e "  ${BLUE}add${NC}     | ${BLUE}a${NC}        Add ACM changes to git"
        echo -e "  ${BLUE}commit${NC}  | ${BLUE}c${NC}        Commit with message"
        echo -e "  ${BLUE}push${NC}              Push to FIDU repository"
        echo -e "  ${BLUE}pull${NC}              Pull from FIDU repository"
        echo -e "  ${BLUE}sync${NC}              Auto-commit, pull, and push"
        echo -e "  ${BLUE}clean${NC}             Clean install dependencies"
        echo -e "  ${BLUE}test${NC}    | ${BLUE}t${NC}        Run tests"
        echo -e "  ${BLUE}help${NC}    | ${BLUE}h${NC}        Show this help"
        echo ""
        echo -e "${YELLOW}Examples:${NC}"
        echo -e "  ./dev-workflow.sh dev"
        echo -e "  ./dev-workflow.sh commit 'Add new feature'"
        echo -e "  ./dev-workflow.sh sync"
        ;;
esac 