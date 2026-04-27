#!/bin/bash

# Script to run the code quality checks for the FIDU Local App
# This script will run the black formatter, pylint, mypy, and pytest with coverage
#
# run with './scripts/lint.sh'
# After running the setup_dev.sh script, this script will be ran automatically as a pre-commit hook

# Currently this script will exit on any error, which will cancel the pre-commit hook. 
# Could be a good space to work on, to allow the pre-commit hook to continue even if there are certain errors
# or warnings present, so the linter is less of a pain. 

# Exit on any error
set -e

# Check if virtual environment exists and activate it if it does
if [ -d ".venv" ]; then
    echo "🔌 Activating virtual environment for code checks..."
    source .venv/bin/activate
fi

echo "🔍 Running code quality checks..."

# Run black formatter
echo "📝 Running black formatter..."
black .

# Run pylint
echo "🔎 Running pylint..."
if ! pylint src/ --output-format=colorized --ignore-paths=".*(node_modules|backup).*"; then
    echo "❌ Pylint found issues in your code. Please fix them before committing."
    echo "NOTE: make sure you are running this within your virtual environment."
    exit 1
fi

# Run mypy type checker
echo "📊 Running mypy type checker..."
mypy src/ --exclude '(^|/)backup(/|$)'

# Run pytest with coverage
echo "🧪 Running pytest with coverage..."
pytest --cov=src --ignore=backup --ignore-glob='*/backup/*'


# Run npm install in chat-lab to ensure installed dependencies match package.json
echo "🔄 Running npm install in chat-lab"
pushd src/apps/chat-lab
npm install
popd

# Run prettier check in chat-lab
echo "💅 Running prettier check in chat-lab"
pushd src/apps/chat-lab
if ! npm run format:check; then
    echo "❌ Prettier found formatting issues in your code. Please run 'npm run format' to fix them."
    exit 1
fi
popd

# Run eslint in chat-lab
echo "🧹 Running eslint in chat-lab"
pushd src/apps/chat-lab
npm run lint
popd

# Run jest in chat-lab with coverage
echo "🔬 Running jest in chat-lab"
pushd src/apps/chat-lab
npm test -- --passWithNoTests --watchAll=false --coverage --coverageReporters=text --coverageReporters=lcov
popd

# Build chat-lab
echo "🛠️ Building chat-lab"
pushd src/apps/chat-lab
npm run build
popd

echo "✅ All checks completed successfully!"
