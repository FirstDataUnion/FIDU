#!/bin/bash

# Script to run the code quality checks for the FIDU Local App
# This script will run the black formatter, pylint, mypy, and pytest with coverage
#
# run with './scripts/lint.sh'
# After running the setup_dev.sh script, this script will be ran automatically as a pre-commit hook

# Exit on any error
set -e

echo "🔍 Running code quality checks..."

# Run black formatter
echo "📝 Running black formatter..."
black .

# Run pylint
echo "🔎 Running pylint..."
pylint src/ --output-format=colorized

# Run mypy type checker
echo "📊 Running mypy type checker..."
mypy src/

# Run pytest with coverage
echo "🧪 Running pytest with coverage..."
pytest --cov=src

echo "✅ All checks completed successfully!" 