#!/bin/bash

# This script is a wrapper around lint.sh to add suitable messaging for when being used as 
# part of the pre-push hook. On a failure, it will provide a useful message to the user
# which is not relevant unless used as a pre-push hook. 

# Function to handle script exit
handle_exit() {
    if [ $? -ne 0 ]; then
        echo """
❌ Code quality checks failed!

           ____ __
          { --.\  |          .)%%%)%%
           '-._\\ | (\___   %)%%(%%(%%%
               `\\|{/ ^ _)-%(%%%%)%%;%%%
           .'^^^^^^^  /'    %%)%%%%)%%%'
          //\   ) ,  /       '%%%%(%%;
    ,  _.`/  \<--  \<
     `^^^`     ^^   ^^

YOUR PUSH HAS BEEN REJECTED BY THE FEROCIOUS LINTER, GUARDIAN OF CODE QUALITY.
Please fix the issues above before pushing.
If you need to bypass these checks temporarily, use:
    git push --no-verify
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