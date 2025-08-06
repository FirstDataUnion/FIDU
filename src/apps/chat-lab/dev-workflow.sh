#!/bin/bash

# Conversation Development Workflow Script
# This script helps with common development tasks for the Conversation front-end

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
  echo -e "${BLUE}🤖 Conversation Development Workflow${NC}"
  echo ""
  echo "Usage: $0 <command> [options]"
  echo ""
  echo "Commands:"
  echo "  ${BLUE}dev${NC}        | ${BLUE}d${NC}        Start development server"
  echo "  ${BLUE}build${NC}      | ${BLUE}b${NC}        Build for production"
  echo "  ${BLUE}test${NC}       | ${BLUE}t${NC}        Run tests"
  echo "  ${BLUE}lint${NC}       | ${BLUE}l${NC}        Run linter"
  echo "  ${BLUE}format${NC}     | ${BLUE}f${NC}        Format code"
  echo "  ${BLUE}add${NC}        | ${BLUE}a${NC}        Add conversation changes to git"
  echo "  ${BLUE}commit${NC}     | ${BLUE}c${NC}        Commit conversation changes"
  echo "  ${BLUE}sync${NC}       | ${BLUE}s${NC}        Auto-sync changes"
  echo "  ${BLUE}help${NC}       | ${BLUE}h${NC}        Show this help"
  echo ""
  echo "Examples:"
  echo "  $0 dev"
  echo "  $0 add"
  echo "  $0 commit 'Add new feature'"
  echo "  $0 sync"
}

# Function to add changes to git
add_changes() {
  echo -e "${YELLOW}➕ Adding conversation changes to git...${NC}"
  git add .
  echo -e "${GREEN}✅ Conversation changes staged!${NC}"
}

# Function to commit changes
commit_changes() {
  if [ -z "$1" ]; then
    echo -e "${RED}❌ Please provide a commit message${NC}"
    echo "Usage: $0 commit 'Your commit message'"
    exit 1
  fi
  
  git commit -m "Conversation: $2"
  echo -e "${GREEN}✅ Changes committed!${NC}"
}

# Function to auto-sync changes
auto_sync() {
  echo -e "${YELLOW}🔄 Auto-syncing conversation changes...${NC}"
  
  # Check if there are changes to commit
  if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}📝 Changes detected, committing...${NC}"
    git add .
    git commit -m "Conversation: Auto-sync changes"
    echo -e "${GREEN}✅ Changes auto-committed!${NC}"
  else
    echo -e "${BLUE}📭 No changes to commit${NC}"
  fi
  
  # Pull latest changes
  echo -e "${YELLOW}⬇️  Pulling latest changes...${NC}"
  git pull origin main
  
  echo -e "${GREEN}✅ Auto-sync complete!${NC}"
}

# Main script logic
case "$1" in
  dev|d)
    echo -e "${BLUE}🚀 Starting development server...${NC}"
    npm run dev
    ;;
  build|b)
    echo -e "${BLUE}🔨 Building for production...${NC}"
    npm run build
    ;;
  test|t)
    echo -e "${BLUE}🧪 Running tests...${NC}"
    npm run test
    ;;
  lint|l)
    echo -e "${BLUE}🔍 Running linter...${NC}"
    npm run lint
    ;;
  format|f)
    echo -e "${BLUE}✨ Formatting code...${NC}"
    npm run format
    ;;
  add|a)
    add_changes
    ;;
  commit|c)
    commit_changes "$@"
    ;;
  sync|s)
    auto_sync
    ;;
  help|h|*)
    show_usage
    ;;
esac 