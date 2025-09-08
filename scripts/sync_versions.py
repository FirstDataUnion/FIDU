#!/usr/bin/env python3
"""
Version synchronization script for FIDU application.
Updates all component version files to match the centralized version.yaml.
"""

import os
import sys
import yaml
import json
from pathlib import Path


def get_project_root():
    """Get the project root directory."""
    return Path(__file__).parent.parent


def load_version_info():
    """Load version information from version.yaml."""
    version_file = get_project_root() / "version.yaml"

    if not version_file.exists():
        raise FileNotFoundError(f"Version file not found: {version_file}")

    with open(version_file, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def update_pyproject_toml(version_info):
    """Update pyproject.toml with the main version."""
    pyproject_file = get_project_root() / "pyproject.toml"

    if not pyproject_file.exists():
        print(f"Warning: pyproject.toml not found at {pyproject_file}")
        return

    # Read current content
    with open(pyproject_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Update version line
    main_version = version_info.get("version", "0.0.0")
    lines = content.split("\n")

    for i, line in enumerate(lines):
        if line.strip().startswith("version = "):
            lines[i] = f'version = "{main_version}"'
            break

    # Write back
    with open(pyproject_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Updated pyproject.toml version to {main_version}")


def update_package_json(version_info, component_name):
    """Update package.json for a specific component."""
    package_file = get_project_root() / "src" / "apps" / component_name / "package.json"

    if not package_file.exists():
        print(f"Warning: package.json not found at {package_file}")
        return

    # Read current content
    with open(package_file, "r", encoding="utf-8") as f:
        package_data = json.load(f)

    # Update version
    component_version = version_info.get("components", {}).get(
        component_name, version_info.get("version", "0.0.0")
    )
    package_data["version"] = component_version

    # Write back
    with open(package_file, "w", encoding="utf-8") as f:
        json.dump(package_data, f, indent=2)

    print(f"Updated {component_name}/package.json version to {component_version}")


def update_chrome_extension_manifest(version_info):
    """Update Chrome extension manifest.json."""
    manifest_file = (
        get_project_root()
        / "src"
        / "data_acquisition"
        / "fidu-chat-grabber"
        / "manifest.json"
    )

    if not manifest_file.exists():
        print(f"Warning: manifest.json not found at {manifest_file}")
        return

    # Read current content
    with open(manifest_file, "r", encoding="utf-8") as f:
        manifest_data = json.load(f)

    # Update version
    component_version = version_info.get("components", {}).get(
        "chat_grabber", version_info.get("version", "0.0.0")
    )
    manifest_data["version"] = component_version

    # Write back
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)

    print(f"Updated Chrome extension manifest version to {component_version}")


def main():
    """Main synchronization function."""
    try:
        print("Syncing versions across all components...")

        # Load version information
        version_info = load_version_info()
        main_version = version_info.get("version", "0.0.0")

        print(f"Main version: {main_version}")
        print(f"Components: {list(version_info.get('components', {}).keys())}")

        # Update all component files
        update_pyproject_toml(version_info)
        update_package_json(version_info, "chat-lab")
        update_chrome_extension_manifest(version_info)

        print("Version synchronization completed successfully!")

    except Exception as e:
        print(f"Error during version synchronization: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
