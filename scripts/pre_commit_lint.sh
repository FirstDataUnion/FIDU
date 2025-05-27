#!/bin/bash

# This script is a wrapper around lint.sh to add suitable messaging for when being used as 
# part of the pre-commit hook. On a failure, it will provide a useful message to the user
# which is not relevant unless used as a pre-commit hook. 

# Function to handle script exit
handle_exit() {
    if [ $? -ne 0 ]; then
        echo """
❌ Code quality checks failed!

YOUR COMMIT HAS BEEN REJECTED BY THE COUNCIL OF LINTERS.
Please fix the issues above before committing.
If you need to bypass these checks temporarily, use:
    git commit --no-verify -m \"justification of your lint-skipping herasy\"
"""
        exit 1
    fi
}

# Set up trap to catch script exit
trap handle_exit EXIT

# Exit on any error
set -e

# Run the lint script
./scripts/lint.sh