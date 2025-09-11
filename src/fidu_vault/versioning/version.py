"""
Version management utilities for FIDU application.
Provides centralized version reading and update checking functionality.
"""

# pylint: disable=broad-exception-caught

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
import yaml

from ..utils.db import get_cursor


def get_project_root() -> Path:
    """Get the project root directory."""
    if getattr(sys, "frozen", False):
        # PyInstaller mode - version.yaml is in the _internal directory
        # _MEIPASS is a PyInstaller-specific attribute that's only available at runtime
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass is None:
            raise RuntimeError("PyInstaller _MEIPASS not available")
        
        # In PyInstaller, the version.yaml file is in the _internal directory
        # which is the same as _MEIPASS
        return Path(meipass)
    # Development mode
    return Path(__file__).parent.parent.parent.parent


def load_version_info() -> Dict[str, Any]:
    """Load version information from version.yaml."""
    project_root = get_project_root()
    version_file = project_root / "version.yaml"

    if not version_file.exists():
        raise FileNotFoundError(f"Version file not found: {version_file}")

    with open(version_file, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_version() -> str:
    """Get the main application version."""
    version_info = load_version_info()
    return version_info.get("version", "0.0.0")


def get_component_version(component: str) -> str:
    """Get version for a specific component."""
    version_info = load_version_info()
    components = version_info.get("components", {})
    return components.get(component, get_version())


def get_build_number() -> int:
    """Get the build number."""
    version_info = load_version_info()
    return version_info.get("build_number", 1)


def get_release_date() -> str:
    """Get the release date."""
    version_info = load_version_info()
    return version_info.get("release_date", "")


def get_release_notes() -> str:
    """Get the release notes."""
    version_info = load_version_info()
    return version_info.get("release_notes", "")


class UpdateChecker:
    """Handles checking for application updates from GitHub releases."""

    # SQL query to create the update check tracking table
    CREATE_TABLE_QUERY = """
    CREATE TABLE IF NOT EXISTS update_check_tracking (
        id INTEGER PRIMARY KEY CHECK (id = 1),  -- Single row table
        last_check_timestamp TEXT NOT NULL,
        last_check_result TEXT,  -- JSON string of last result or null
        created_timestamp TEXT NOT NULL,
        updated_timestamp TEXT NOT NULL
    )
    """

    def __init__(self):
        self.version_info = load_version_info()
        self.github_repo = self.version_info.get("update_check", {}).get(
            "github_repo", ""
        )
        self.check_interval = self.version_info.get("update_check", {}).get(
            "check_interval_hours", 24
        )
        self.auto_check_enabled = self.version_info.get("update_check", {}).get(
            "auto_check_enabled", True
        )
        self._ensure_table_exists()

    def _ensure_table_exists(self):
        """Ensure the update check tracking table exists."""
        try:
            with get_cursor() as cursor:
                cursor.execute(self.CREATE_TABLE_QUERY)
        except Exception as e:
            print(f"Error creating update check tracking table: {e}")
            raise

    def _get_current_timestamp(self) -> str:
        """Get current timestamp as ISO string."""
        return datetime.now(timezone.utc).isoformat()

    def _get_last_check_time(self) -> Optional[datetime]:
        """Get the timestamp of the last update check."""
        try:
            with get_cursor() as cursor:
                cursor.execute(
                    "SELECT last_check_timestamp FROM update_check_tracking WHERE id = 1"
                )
                result = cursor.fetchone()
                if result:
                    return datetime.fromisoformat(result[0])
                return None
        except Exception as e:
            print(f"Error getting last check time: {e}")
            return None

    def _update_last_check_time(self, result: Optional[Dict[str, Any]] = None):
        """Update the last check timestamp and result."""
        try:
            current_time = self._get_current_timestamp()
            result_json = json.dumps(result) if result else None

            with get_cursor() as cursor:
                # Try to update existing row
                cursor.execute(
                    """
                    UPDATE update_check_tracking 
                    SET last_check_timestamp = ?, 
                        last_check_result = ?, 
                        updated_timestamp = ?
                    WHERE id = 1
                """,
                    (current_time, result_json, current_time),
                )

                # If no rows were updated, insert a new one
                if cursor.rowcount == 0:
                    cursor.execute(
                        """
                        INSERT INTO update_check_tracking 
                        (id, last_check_timestamp, last_check_result, 
                         created_timestamp, updated_timestamp)
                        VALUES (1, ?, ?, ?, ?)
                    """,
                        (current_time, result_json, current_time, current_time),
                    )
        except Exception as e:
            print(f"Error updating last check time: {e}")

    async def check_for_updates(self) -> Optional[Dict[str, Any]]:
        """
        Check for updates from GitHub releases.
        Returns update info if available, None if no updates.
        Respects the check interval to avoid excessive API calls.
        """
        if not self.github_repo or not self.auto_check_enabled:
            return None

        # Check if enough time has passed since last check
        if not self.should_check_for_updates():
            # Return cached result if available
            return self._get_cached_result()

        try:
            async with httpx.AsyncClient() as client:
                # Get all releases (including prereleases)
                response = await client.get(
                    f"https://api.github.com/repos/{self.github_repo}/releases",
                    timeout=10.0,
                )
                response.raise_for_status()
                releases_data = response.json()

                if not releases_data:
                    self._update_last_check_time(None)
                    return None

                # Get the latest release (first in the list)
                release_data = releases_data[0]
                latest_version = release_data.get("tag_name", "").lstrip("v")
                current_version = get_version()

                result = None
                if self._is_newer_version(latest_version, current_version):
                    result = {
                        "latest_version": latest_version,
                        "current_version": current_version,
                        "release_notes": release_data.get("body", ""),
                        "download_url": release_data.get("html_url", ""),
                        "published_at": release_data.get("published_at", ""),
                        "prerelease": release_data.get("prerelease", False),
                    }

                # Update the last check time and result
                self._update_last_check_time(result)
                return result

        except Exception as e:
            print(f"Error checking for updates: {e}")
            # Don't update the check time on error, so we can retry sooner
            return None

    def _is_newer_version(self, latest: str, current: str) -> bool:
        """Compare version strings to determine if latest is newer."""
        try:
            latest_parts = [int(x) for x in latest.split(".")]
            current_parts = [int(x) for x in current.split(".")]

            # Pad with zeros if needed
            max_len = max(len(latest_parts), len(current_parts))
            latest_parts.extend([0] * (max_len - len(latest_parts)))
            current_parts.extend([0] * (max_len - len(current_parts)))

            return latest_parts > current_parts
        except ValueError:
            # If version parsing fails, assume latest is newer
            return latest != current

    def should_check_for_updates(self) -> bool:
        """Check if enough time has passed since last update check."""
        if not self.auto_check_enabled:
            return False

        last_check_time = self._get_last_check_time()
        if last_check_time is None:
            # Never checked before, so we should check
            return True

        # Calculate time difference
        time_since_last_check = datetime.now(timezone.utc) - last_check_time
        hours_since_last_check = time_since_last_check.total_seconds() / 3600

        return hours_since_last_check >= self.check_interval

    def _get_cached_result(self) -> Optional[Dict[str, Any]]:
        """Get the cached result from the last successful check."""
        try:
            with get_cursor() as cursor:
                cursor.execute(
                    "SELECT last_check_result FROM update_check_tracking WHERE id = 1"
                )
                result = cursor.fetchone()
                if result and result[0]:
                    return json.loads(result[0])
                return None
        except Exception as e:
            print(f"Error getting cached result: {e}")
            return None

    async def force_check_for_updates(self) -> Optional[Dict[str, Any]]:
        """
        Force check for updates, ignoring the timer interval.
        Useful for testing or manual update checks.
        """
        if not self.github_repo or not self.auto_check_enabled:
            return None

        try:
            async with httpx.AsyncClient() as client:
                # Get all releases (including prereleases)
                response = await client.get(
                    f"https://api.github.com/repos/{self.github_repo}/releases",
                    timeout=10.0,
                )
                response.raise_for_status()
                releases_data = response.json()

                if not releases_data:
                    self._update_last_check_time(None)
                    return None

                # Get the latest release (first in the list)
                release_data = releases_data[0]
                latest_version = release_data.get("tag_name", "").lstrip("v")
                current_version = get_version()

                result = None
                if self._is_newer_version(latest_version, current_version):
                    result = {
                        "latest_version": latest_version,
                        "current_version": current_version,
                        "release_notes": release_data.get("body", ""),
                        "download_url": release_data.get("html_url", ""),
                        "published_at": release_data.get("published_at", ""),
                        "prerelease": release_data.get("prerelease", False),
                    }

                # Update the last check time and result
                self._update_last_check_time(result)
                return result

        except Exception as e:
            print(f"Error checking for updates: {e}")
            return None


# Convenience functions for easy access
def get_app_version() -> str:
    """Get the main application version (alias for get_version)."""
    return get_version()


def get_vault_version() -> str:
    """Get the vault component version."""
    return get_component_version("vault")


def get_chat_lab_version() -> str:
    """Get the chat lab component version."""
    return get_component_version("chat_lab")


def get_chat_grabber_version() -> str:
    """Get the chat grabber component version."""
    return get_component_version("chat_grabber")
