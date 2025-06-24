#!/bin/bash

# Script to manage git hooks for FIDU project
# Usage: ./scripts/manage_hooks.sh [enable-pre-commit|disable-pre-commit|enable-pre-push|disable-pre-push|status]

set -e

HOOKS_DIR=".git/hooks"

case "${1:-status}" in
    "enable-pre-commit")
        echo "🔧 Enabling pre-commit hook..."
        if [ -f "$HOOKS_DIR/pre-commit.disabled" ]; then
            mv "$HOOKS_DIR/pre-commit.disabled" "$HOOKS_DIR/pre-commit"
            chmod +x "$HOOKS_DIR/pre-commit"
            echo "✅ Pre-commit hook enabled"
        else
            echo "⚠️  Pre-commit hook already enabled or not found"
        fi
        ;;
    "disable-pre-commit")
        echo "🔧 Disabling pre-commit hook..."
        if [ -f "$HOOKS_DIR/pre-commit" ]; then
            mv "$HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-commit.disabled"
            echo "✅ Pre-commit hook disabled"
        else
            echo "⚠️  Pre-commit hook already disabled or not found"
        fi
        ;;
    "enable-pre-push")
        echo "🔧 Enabling pre-push hook..."
        if [ -f "$HOOKS_DIR/pre-push" ]; then
            chmod +x "$HOOKS_DIR/pre-push"
            echo "✅ Pre-push hook enabled"
        else
            echo "❌ Pre-push hook not found"
        fi
        ;;
    "disable-pre-push")
        echo "🔧 Disabling pre-push hook..."
        if [ -f "$HOOKS_DIR/pre-push" ]; then
            chmod -x "$HOOKS_DIR/pre-push"
            echo "✅ Pre-push hook disabled"
        else
            echo "❌ Pre-push hook not found"
        fi
        ;;
    "status")
        echo "📋 Git hooks status:"
        echo ""
        if [ -f "$HOOKS_DIR/pre-commit" ] && [ -x "$HOOKS_DIR/pre-commit" ]; then
            echo "✅ Pre-commit hook: ENABLED"
        elif [ -f "$HOOKS_DIR/pre-commit.disabled" ]; then
            echo "❌ Pre-commit hook: DISABLED"
        else
            echo "❓ Pre-commit hook: NOT FOUND"
        fi
        
        if [ -f "$HOOKS_DIR/pre-push" ] && [ -x "$HOOKS_DIR/pre-push" ]; then
            echo "✅ Pre-push hook: ENABLED"
        else
            echo "❌ Pre-push hook: DISABLED"
        fi
        echo ""
        echo "Usage: $0 [enable-pre-commit|disable-pre-commit|enable-pre-push|disable-pre-push|status]"
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Usage: $0 [enable-pre-commit|disable-pre-commit|enable-pre-push|disable-pre-push|status]"
        exit 1
        ;;
esac 