#!/bin/bash

# Script to setup the development environment for the FIDU Local App
# This script will:
# - create a virtual environment and install the necessary dependencies
# - create a .env file if it doesn't exist
# - install the pre-push hooks
#
# IMPORTANT: This script must be run using 'source scripts/setup_dev.sh'
# Running it with './scripts/setup_dev.sh' will not work activate the 
# virtual environment correctly. 

# Check if script is being sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "❌ This script must be run using 'source scripts/setup_dev.sh'"
    echo "❌ Running it with './scripts/setup_dev.sh' will not work correctly"
    return 1
fi

echo "🚀 Setting up development environment..."

# Check Python version
python_version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
required_version="3.8"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Python version $required_version or higher is required. You have $python_version"
    return 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
if [ ! -f ".venv/bin/activate" ]; then
    echo "❌ Virtual environment activation script not found"
    return 1
fi

source .venv/bin/activate

# Verify activation worked
if [ -z "$VIRTUAL_ENV" ]; then
    echo "❌ Virtual environment activation failed"
    return 1
fi

echo "✅ Virtual environment activated: $VIRTUAL_ENV"

# Upgrade pip
echo "⬆️  Upgrading pip..."
if ! pip install --upgrade pip; then
    echo "❌ Failed to upgrade pip"
    return 1
fi

# Install requirements
echo "📚 Installing requirements..."
if ! pip install -r requirements.txt; then
    echo "❌ Failed to install requirements"
    return 1
fi

# Install the package in development mode with all dev dependencies
echo "📚 Installing package with development dependencies..."
if ! pip install -e ".[dev]"; then
    echo "❌ Failed to install package with dev dependencies"
    return 1
fi

# Install PyInstaller for building executables
echo "📦 Installing PyInstaller..."
if ! pip install pyinstaller; then
    echo "❌ Failed to install PyInstaller"
    return 1
fi

# Install pre-push hooks
echo "🔧 Installing pre-push hooks..."
if [ ! -f "scripts/githooks/pre-push" ]; then
    echo "❌ Pre-push hook script not found"
    return 1
fi

# 'install' the pre-push hook
cp scripts/githooks/pre-push .git/hooks/pre-push
# Ensure the pre-push hook is executable
chmod +x .git/hooks/pre-push
# Disable pre-commit hook if it exists (migrating to pre-push)
if [ -f ".git/hooks/pre-commit" ]; then
    mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled
    echo "✅ Pre-commit hook disabled, pre-push hook enabled"
else
    echo "✅ Pre-push hook enabled"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env from .env.example"
    else
        echo "# Add your environment variables here" > .env
        echo "✅ Created empty .env file"
    fi
fi

# Install npm dependencies for chat-lab
echo "📦 Installing npm dependencies for chat-lab..."
if [ ! -d "src/apps/chat-lab" ]; then
    echo "❌ chat-lab directory not found"
    return 1
fi

cd src/apps/chat-lab
if ! npm install --legacy-peer-deps; then
    echo "❌ Failed to install npm dependencies"
    return 1
fi

# Install @types/node for TypeScript support in vite.config.ts
if ! npm install --save-dev @types/node; then
    echo "⚠️  Warning: Failed to install @types/node"
fi

cd ../../..

# Install mypy type stubs
echo "📝 Installing mypy type stubs..."
# MyPy often fails on the first attempt to install the type stubs due to 
# being unable to find certain venv files despite them existing. 
# Reactivating the .venv seems to be the most reliable way to make it find the 
# existing files. 
source .venv/bin/activate 

mypy_failed=false
if ! mypy --install-types --non-interactive src/; then
    echo "⚠️  First mypy attempt failed, trying again..."
    # Try one more time after a brief delay
    sleep 2
    if ! mypy --install-types --non-interactive src/; then
        mypy_failed=true
        echo "⚠️  Mypy type stub installation failed"
    else
        echo "✅ Mypy type stubs installed on second attempt"
    fi
else
    echo "✅ Mypy type stubs installed"
fi

echo """
🍰 Preparing development incentive...

            ,:/+/-
            /M/              .,-=;//;-
       .:/= ;MH/,    ,=/+%&XH@MM#@:
      -@##@+####@H@MMM#######H:.    -/H#
 .,H@H@ X######@ -H#####@+-     -+H###@X
  .,@##H;      +XM##M/,     =%@###@X;-
X%-  :M##########$.    .:%M###@%:
M##H,   +H@@@$/-.  ,;&M###@%,          -
M####M=,,---,.-%%H####M$:          ,+@##
@##################@/.         :%H##@##
M###############H,         ;HM##M$=
#################.    .=&M##M$=
################H..;XM##M$=          .:+
M###################@%=           =+@MH%
@################M/.          =+H#X%=
=+M##############M,       -/X#X+;.
  .;XM##########H=    ,/X#H+:,
     .=+HM######M+/+HM@+=.
         ,:/%XM####H/.
              ,.:=-.                    

✅ Development environment setup complete!

The virtual environment has been activated automatically.
You can now run the server with:

uvicorn src.fidu_vault.main:app --port 4000 --reload

Code quality checks will run automatically before each push.
To manage hooks, use: ./scripts/manage_hooks.sh status

"""

if [ "$mypy_failed" = true ]; then
    echo """
⚠️  Warning: The mypy type stub installation failed. 
    This command sometimes requires multiple attempts to complete.
    You can try running it manually later:
    
    source .venv/bin/activate
    mypy --install-types --non-interactive src/
"""
fi