# ACM Development Aliases
# Source this file to get convenient shortcuts for ACM development
# Usage: source /home/tony/bin/FIDU/acm-aliases.sh

# Navigate to ACM project
alias acm='cd /home/tony/bin/FIDU/src/apps/acm-front-end'
alias acm-root='cd /home/tony/bin/FIDU'

# Development shortcuts
alias acm-dev='cd /home/tony/bin/FIDU/src/apps/acm-front-end && npm run dev'
alias acm-build='cd /home/tony/bin/FIDU/src/apps/acm-front-end && npm run build'
alias acm-preview='cd /home/tony/bin/FIDU/src/apps/acm-front-end && npm run preview'
alias acm-install='cd /home/tony/bin/FIDU/src/apps/acm-front-end && npm install'

# Git shortcuts for ACM
alias acm-status='cd /home/tony/bin/FIDU && git status'
alias acm-add='cd /home/tony/bin/FIDU && git add src/apps/acm-front-end/'
alias acm-push='cd /home/tony/bin/FIDU && git push origin main'
alias acm-pull='cd /home/tony/bin/FIDU && git pull origin main'

# Workflow shortcuts
alias acm-workflow='cd /home/tony/bin/FIDU/src/apps/acm-front-end && ./dev-workflow.sh'
alias acm-sync='cd /home/tony/bin/FIDU/src/apps/acm-front-end && ./dev-workflow.sh sync'

# Quick commit function
acm-commit() {
    if [ -z "$1" ]; then
        echo "Usage: acm-commit 'Your commit message'"
        return 1
    fi
    cd /home/tony/bin/FIDU
    git add src/apps/acm-front-end/
    git commit -m "ACM: $1"
    echo "✅ Committed: ACM: $1"
}

# Open manual and docs
alias acm-manual='cd /home/tony/bin/FIDU/src/apps/acm-front-end && xdg-open manual.html'
alias acm-docs='cd /home/tony/bin/FIDU/src/apps/acm-front-end && xdg-open front-end-technical-description.html'

# Show ACM info
acm-info() {
    echo "🤖 ACM (AI Conversation Manager) Development Environment"
    echo "========================================================"
    echo "📁 ACM Project: /home/tony/bin/FIDU/src/apps/acm-front-end"
    echo "📁 FIDU Root:   /home/tony/bin/FIDU"
    echo "🌐 Repository:  https://github.com/FirstDataUnion/FIDU"
    echo ""
    echo "🚀 Quick Commands:"
    echo "  acm           - Navigate to ACM project"
    echo "  acm-dev       - Start development server"
    echo "  acm-workflow  - Run workflow script"
    echo "  acm-sync      - Auto-commit, pull, and push"
    echo "  acm-commit    - Quick commit with message"
    echo "  acm-manual    - Open user manual"
    echo "  acm-info      - Show this info"
    echo ""
    echo "📊 Current Status:"
    cd /home/tony/bin/FIDU
    git status --porcelain src/apps/acm-front-end/ | head -5
    if [ $(git status --porcelain src/apps/acm-front-end/ | wc -l) -gt 5 ]; then
        echo "   ... and $(expr $(git status --porcelain src/apps/acm-front-end/ | wc -l) - 5) more files"
    fi
}

echo "✅ ACM aliases loaded! Run 'acm-info' for help." 