"""
Version API endpoints for FIDU application.
Provides version information and update checking functionality.
"""

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from ..versioning.version import (
    UpdateChecker,
    get_build_number,
    get_component_version,
    get_release_date,
    get_release_notes,
    get_version,
)

router = APIRouter(prefix="/version", tags=["version"])


@router.get("/")
async def get_version_info() -> Dict[str, Any]:
    """Get current version information for all components."""
    return {
        "main_version": get_version(),
        "build_number": get_build_number(),
        "release_date": get_release_date(),
        "release_notes": get_release_notes(),
        "components": {
            "vault": get_component_version("vault"),
            "chat_lab": get_component_version("chat_lab"),
            "chat_grabber": get_component_version("chat_grabber"),
        },
    }


@router.get("/check-updates")
async def check_for_updates() -> Dict[str, Any]:
    """Check for available updates from GitHub releases."""
    try:
        update_checker = UpdateChecker()

        if not update_checker.should_check_for_updates():
            return {
                "status": "skipped",
                "message": "Update check skipped (disabled or too frequent)",
                "current_version": get_version(),
                "next_check_in_hours": update_checker.check_interval,
            }

        update_info = await update_checker.check_for_updates()

        if update_info:
            return {
                "status": "update_available",
                "current_version": update_info["current_version"],
                "latest_version": update_info["latest_version"],
                "release_notes": update_info["release_notes"],
                "download_url": update_info["download_url"],
                "published_at": update_info["published_at"],
                "prerelease": update_info["prerelease"],
            }
        return {
            "status": "up_to_date",
            "current_version": get_version(),
            "message": "Application is up to date",
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error checking for updates: {str(e)}"
        ) from e


@router.post("/force-check-updates")
async def force_check_for_updates() -> Dict[str, Any]:
    """Force check for updates, ignoring the timer interval."""
    try:
        update_checker = UpdateChecker()
        update_info = await update_checker.force_check_for_updates()

        if update_info:
            return {
                "status": "update_available",
                "current_version": update_info["current_version"],
                "latest_version": update_info["latest_version"],
                "release_notes": update_info["release_notes"],
                "download_url": update_info["download_url"],
                "published_at": update_info["published_at"],
                "prerelease": update_info["prerelease"],
            }
        return {
            "status": "up_to_date",
            "current_version": get_version(),
            "message": "Application is up to date",
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error checking for updates: {str(e)}"
        ) from e


@router.get("/component/{component_name}")
async def get_component_version_info(component_name: str) -> Dict[str, Any]:
    """Get version information for a specific component."""
    valid_components = ["vault", "chat_lab", "chat_grabber"]

    if component_name not in valid_components:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid component name. Must be one of: {valid_components}",
        )

    return {
        "component": component_name,
        "version": get_component_version(component_name),
        "main_version": get_version(),
        "build_number": get_build_number(),
        "release_date": get_release_date(),
    }
