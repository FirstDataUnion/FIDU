#!/bin/bash

# Script to setup the development environment for the FIDU Local App
# This script will:
# - create a virtual environment and install the necessary dependencies
# - create a .env file if it doesn't exist
# - install the pre-commit hooks
#
# IMPORTANT: This script must be run using 'source scripts/setup_dev.sh'
# Running it with './scripts/setup_dev.sh' will not work activate the 
# virtual environment correctly. 

# Check if script is being sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "❌ This script must be run using 'source scripts/setup_dev.sh'"
    echo "❌ Running it with './scripts/setup_dev.sh' will not work correctly"
    exit 1
fi

echo "🚀 Setting up development environment..."

# Check Python version
python_version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
required_version="3.8"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Python version $required_version or higher is required. You have $python_version"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source .venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "📚 Installing requirements..."
pip install -r requirements.txt

# Install the package in development mode with all dev dependencies
echo "📚 Installing package with development dependencies..."
pip install -e ".[dev]"

# Install pre-commit hooks
echo "🔧 Installing pre-commit hooks..."
pre-commit install

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env 2>/dev/null || echo "# Add your environment variables here" > .env
fi

# Install npm dependencies for acm-front-end
echo "Installing npm dependencies for acm-front-end..."
cd src/apps/acm-front-end
npm install --legacy-peer-deps
cd ../../..

# Install mypy type stubs
echo "📝 Installing mypy type stubs..."
if ! mypy --install-types --non-interactive src/; then
    mypy_failed=true
else
    mypy_failed=false
fi

echo """
🍰 Preparing development incentive...

            ,:/+/-
            /M/              .,-=;//;-
       .:/= ;MH/,    ,=/+%$XH@MM#@:
      -$##@+$###@H@MMM#######H:.    -/H#
 .,H@H@ X######@ -H#####@+-     -+H###@X
  .,@##H;      +XM##M/,     =%@###@X;-
X%-  :M##########$.    .:%M###@%:
M##H,   +H@@@$/-.  ,;$M###@%,          -
M####M=,,---,.-%%H####M$:          ,+@##
@##################@/.         :%H##@$-
M###############H,         ;HM##M$=
#################.    .=$M##M$=
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

uvicorn src.fidu_core.main:app --port 4000 --reload

"""

if [ "$mypy_failed" = true ]; then
    echo """
⚠️  Warning: The mypy type stub installation failed. 
    This command sometimes requires multiple attempts to complete.
    Rerunning the same command again or manually running:
    mypy --install-types src/
    will fix the issues. 
"""
fi