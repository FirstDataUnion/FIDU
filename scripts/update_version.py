#!/usr/bin/env python3
"""
Version update script for FIDU application.
Updates the centralized version.yaml and syncs all components.
"""

import os
import sys
import yaml
import argparse
from pathlib import Path


def get_project_root():
    """Get the project root directory."""
    return Path(__file__).parent.parent


def update_version_file(
    new_version, component=None, build_number=None, release_notes=None
):
    """Update the version.yaml file with new version information."""
    version_file = get_project_root() / "version.yaml"

    # Load current version info
    with open(version_file, "r", encoding="utf-8") as f:
        version_info = yaml.safe_load(f)

    # Update main version
    if component is None:
        version_info["version"] = new_version
        # Update all components to match main version
        for comp in version_info.get("components", {}):
            version_info["components"][comp] = new_version
    else:
        # Update specific component
        if "components" not in version_info:
            version_info["components"] = {}
        version_info["components"][component] = new_version

    # Update build number if provided
    if build_number is not None:
        version_info["build_number"] = build_number
    else:
        # Auto-increment build number
        current_build = version_info.get("build_number", 1)
        version_info["build_number"] = current_build + 1

    # Update release notes if provided
    if release_notes is not None:
        version_info["release_notes"] = release_notes

    # Write back to file
    with open(version_file, "w", encoding="utf-8") as f:
        yaml.dump(version_info, f, default_flow_style=False, sort_keys=False)

    print(f"Updated version.yaml:")
    print(f"  Main version: {version_info['version']}")
    print(f"  Build number: {version_info['build_number']}")
    if component:
        print(f"  {component} version: {version_info['components'][component]}")
    else:
        print(f"  All components: {version_info['components']}")


def main():
    """Main function for version updates."""
    parser = argparse.ArgumentParser(description="Update FIDU application version")
    parser.add_argument("version", help="New version number (e.g., 0.2.0)")
    parser.add_argument(
        "--component",
        choices=["vault", "chat_lab", "chat_grabber"],
        help="Update specific component only",
    )
    parser.add_argument("--build", type=int, help="Set specific build number")
    parser.add_argument("--notes", help="Release notes")
    parser.add_argument(
        "--sync",
        action="store_true",
        help="Automatically sync all component files after update",
    )

    args = parser.parse_args()

    try:
        print(f"Updating version to {args.version}...")
        update_version_file(args.version, args.component, args.build, args.notes)

        if args.sync:
            print("\nSyncing component files...")
            import subprocess

            result = subprocess.run(
                [
                    sys.executable,
                    str(get_project_root() / "scripts" / "sync_versions.py"),
                ],
                capture_output=True,
                text=True,
            )

            if result.returncode == 0:
                print("Component files synced successfully!")
            else:
                print(f"Error syncing files: {result.stderr}")
                sys.exit(1)

        print("\nVersion update completed successfully!")

    except Exception as e:
        print(f"Error updating version: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
