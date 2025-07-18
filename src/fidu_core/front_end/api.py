"""Frontend API for HTMX-based user interface."""

import os
import json
import logging
import sys
from pathlib import Path
from typing import Optional, Union
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates
from fastapi.security import HTTPBearer
from fidu_core.security import JWTManager, PasswordHasher
from fidu_core.data_packets.service import DataPacketService
from fidu_core.data_packets.schema import DataPacketQueryParamsInternal
from fidu_core.data_packets.exceptions import DataPacketError
from fidu_core.identity_service.client import (
    get_user_from_identity_service,
    create_profile,
)


def get_base_path():
    """Get the base path for the application, handling PyInstaller bundling."""
    if getattr(sys, "frozen", False):
        # Running in a PyInstaller bundle
        return Path(sys._MEIPASS)  # pylint: disable=protected-access
    # Running in normal Python environment
    # In development, we need to go up to the project root
    return Path(__file__).parent.parent.parent


# Get the base path
BASE_PATH = get_base_path()

logger = logging.getLogger(__name__)

# Security scheme for token authentication
security = HTTPBearer(auto_error=False)


class FrontEndAPI:
    """Frontend API for HTMX-based user interface."""

    def __init__(
        self,
        app: FastAPI,
        data_packet_service: DataPacketService,
    ) -> None:
        """Initialize the frontend API.

        Args:
            app: The FastAPI app to mount the API on
            data_packet_service: The data packet service layer
        """
        self.app = app
        self.data_packet_service = data_packet_service
        self.jwt_manager = JWTManager()
        self.password_hasher = PasswordHasher()

        templates_dir = BASE_PATH / "fidu_core" / "front_end" / "templates"

        self.templates = Jinja2Templates(directory=str(templates_dir))
        self._setup_routes()

    def _setup_routes(self) -> None:
        """Set up the API routes."""
        self.app.add_api_route(
            "/",
            self.home,
            methods=["GET"],
            response_model=None,
        )
        self.app.add_api_route(
            "/logout",
            self.logout,
            methods=["POST"],
            response_model=None,
        )
        self.app.add_api_route(
            "/dashboard",
            self.dashboard,
            methods=["GET"],
            response_model=None,
        )
        self.app.add_api_route(
            "/data-packets",
            self.data_packets_page,
            methods=["GET"],
            response_model=None,
        )
        self.app.add_api_route(
            "/data-packets/list",
            self.data_packets_list,
            methods=["GET"],
            response_model=None,
            response_class=HTMLResponse,
        )
        self.app.add_api_route(
            "/data-packets/delete",
            self.delete_data_packet,
            methods=["DELETE"],
            response_model=None,
            response_class=HTMLResponse,
        )
        self.app.add_api_route(
            "/profiles",
            self.profiles_page,
            methods=["GET"],
            response_model=None,
        )
        self.app.add_api_route(
            "/profiles/list",
            self.profiles_list,
            methods=["GET"],
            response_model=None,
            response_class=HTMLResponse,
        )
        self.app.add_api_route(
            "/profiles/create",
            self.create_profile,
            methods=["POST"],
            response_model=None,
            response_class=HTMLResponse,
        )
        self.app.add_api_route(
            "/apps",
            self.apps_page,
            methods=["GET"],
            response_model=None,
        )

    async def _get_current_user_id(self, request: Request) -> Optional[str]:
        """Get the current user ID from the request token."""
        try:
            # Check for token in cookies first
            token = request.cookies.get("auth_token")
            if not token:
                # Fall back to Authorization header
                auth_header = request.headers.get("Authorization")
                if auth_header and auth_header.startswith("Bearer "):
                    token = auth_header[7:]

            if token:
                # Fetch user from identity service
                user = await get_user_from_identity_service(token)
                return user.id if user else None
        # TODO: This is not the right kind of exception to catch here, should adjust what is
        # returned from jwt_manager
        # Catch unauthed exceptions from jwt_manager
        except HTTPException:
            pass
        return None

    def _get_session_data(self, request: Request, key: str, default=None):
        """Get data from session (stored in cookies for simplicity)."""
        try:
            session_data = request.cookies.get("session_data", "{}")
            data = json.loads(session_data)
            return data.get(key, default)
        except (json.JSONDecodeError, TypeError, AttributeError):
            return default

    def _set_session_data(self, request: Request, response: Response, key: str, value):
        """Set data in session (stored in cookies for simplicity)."""
        try:
            # Read current session data from request
            session_data = request.cookies.get("session_data", "{}")
            data = json.loads(session_data)
            data[key] = value
            # Set updated session data in response
            response.set_cookie(
                key="session_data",
                value=json.dumps(data),
                httponly=True,
                secure=False,
                samesite="lax",
                max_age=3600,
            )
        except (json.JSONDecodeError, TypeError, AttributeError):
            pass

    def _decode_body(self, body: bytes | memoryview) -> str:
        """Decode a bytes or memoryview object to a string for HTMLResponse."""
        if isinstance(body, memoryview):
            return body.tobytes().decode()
        return body.decode()

    async def home(self, request: Request) -> Union[HTMLResponse, RedirectResponse]:
        """Serve the home page with login/register options."""
        user_id = await self._get_current_user_id(request)

        if user_id:
            # User is logged in, redirect to dashboard
            return RedirectResponse(url="/dashboard", status_code=302)

        # Get the identity service URL from the environment variable, or use default
        identity_service_url = os.environ.get(
            "FIDU_IDENTITY_SERVICE_URL", " https://identity.firstdataunion.org"
        )

        response = self.templates.TemplateResponse(
            "home.html",
            {
                "request": request,
                "error": None,
                "identity_service_url": identity_service_url,
            },
        )
        return HTMLResponse(content=self._decode_body(response.body), status_code=200)

    async def logout(self, _request: Request) -> Union[HTMLResponse, RedirectResponse]:
        """Handle user logout."""
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Logging out...</title>
        </head>
        <body>
            <script>
                // Clear localStorage auth keys
                localStorage.removeItem('auth_token');
                localStorage.removeItem('fiduToken');
                
                // Clear sessionStorage as well
                sessionStorage.removeItem('auth_token');
                sessionStorage.removeItem('fiduToken');
                
                // Redirect to home page
                window.location.href = '/';
            </script>
            <p>Logging out...</p>
        </body>
        </html>
        """
        response = HTMLResponse(content=html_content)
        response.delete_cookie("auth_token")
        response.delete_cookie("session_data")

        return response

    async def dashboard(
        self, request: Request
    ) -> Union[HTMLResponse, RedirectResponse]:
        """Serve the main dashboard."""
        try:
            user = await get_user_from_identity_service(
                request.cookies.get("auth_token") or ""
            )

            response = self.templates.TemplateResponse(
                "dashboard.html", {"request": request, "user": user}
            )
            return HTMLResponse(
                content=self._decode_body(response.body), status_code=200
            )
        except HTTPException as e:
            if e.status_code == 401:
                return RedirectResponse(url="/", status_code=302)

            raise e

    async def data_packets_page(
        self, request: Request
    ) -> Union[HTMLResponse, RedirectResponse]:
        """Serve the data packets page."""
        try:
            user = await get_user_from_identity_service(
                request.cookies.get("auth_token") or ""
            )

            response = self.templates.TemplateResponse(
                "data_packets.html", {"request": request, "user": user}
            )
            return HTMLResponse(
                content=self._decode_body(response.body), status_code=200
            )
        except HTTPException as e:
            if e.status_code == 401:
                return RedirectResponse(url="/", status_code=302)

            raise e

    async def data_packets_list(
        self, request: Request
    ) -> HTMLResponse | RedirectResponse:
        """Serve the data packets list (HTMX endpoint)."""
        try:
            user = await get_user_from_identity_service(
                request.cookies.get("auth_token") or ""
            )

            # Get query parameters for filtering
            profile_id = request.query_params.get("profile_id")
            tags = request.query_params.get("tags")
            limit = request.query_params.get("limit", "25")

            # Store current query parameters in session
            query_params = {
                "profile_id": profile_id or "",
                "tags": tags or "",
                "limit": limit,
            }

            # Get available profiles for the dropdown
            available_profiles = user.profiles if user else []

            # Create query params for service
            query_params_internal = DataPacketQueryParamsInternal(
                user_id=user.id if user else "",
                profile_id=profile_id if profile_id else None,
                tags=[tag.strip() for tag in tags.split(",")] if tags else None,
                from_timestamp=None,
                to_timestamp=None,
                limit=int(limit),
                offset=0,
                sort_order="desc",
            )

            data_packets = self.data_packet_service.list_data_packets(
                query_params_internal
            )

            response = self.templates.TemplateResponse(
                "data_packets_list.html",
                {
                    "request": request,
                    "data_packets": data_packets,
                    "query_params": query_params,
                    "available_profiles": available_profiles,
                },
            )
            return HTMLResponse(
                content=self._decode_body(response.body), status_code=200
            )
        except HTTPException as e:
            if e.status_code == 401:
                return RedirectResponse(url="/", status_code=302)

            raise e
        except (DataPacketError, ValueError, TypeError) as e:
            logger.error("Data packets list error: %s", e)
            return HTMLResponse("Error loading data packets.", status_code=500)

    async def delete_data_packet(
        self, request: Request
    ) -> HTMLResponse | RedirectResponse:
        """Handle data packet deletion (HTMX endpoint)."""
        try:
            user = await get_user_from_identity_service(
                request.cookies.get("auth_token") or ""
            )

            data_packet_id = request.query_params.get("data_packet_id")

            if not data_packet_id:
                return HTMLResponse("Data packet ID is required.", status_code=400)

            self.data_packet_service.delete_data_packet(
                user.id if user else "", data_packet_id
            )

            return HTMLResponse("Data packet deleted successfully.", status_code=200)

        except HTTPException as e:
            if e.status_code == 401:
                return RedirectResponse(url="/", status_code=302)

            raise e
        except (DataPacketError, ValueError, TypeError) as e:
            logger.error("Delete data packet error: %s", e)
            return HTMLResponse("Error deleting data packet.", status_code=500)

    async def profiles_page(
        self, request: Request
    ) -> Union[HTMLResponse, RedirectResponse]:
        """Serve the profiles page."""
        try:
            user = await get_user_from_identity_service(
                request.cookies.get("auth_token") or ""
            )

            response = self.templates.TemplateResponse(
                "profiles.html", {"request": request, "user": user}
            )
            return HTMLResponse(
                content=self._decode_body(response.body), status_code=200
            )
        except HTTPException as e:
            if e.status_code == 401:
                return RedirectResponse(url="/", status_code=302)

            raise e

    async def apps_page(
        self, request: Request
    ) -> Union[HTMLResponse, RedirectResponse]:
        """Serve the apps page."""
        try:
            user = await get_user_from_identity_service(
                request.cookies.get("auth_token") or ""
            )

            response = self.templates.TemplateResponse(
                "apps.html", {"request": request, "user": user}
            )
            return HTMLResponse(
                content=self._decode_body(response.body), status_code=200
            )
        except HTTPException as e:
            if e.status_code == 401:
                return RedirectResponse(url="/", status_code=302)

            raise e

    async def profiles_list(self, request: Request) -> HTMLResponse | RedirectResponse:
        """Serve the profiles list (HTMX endpoint)."""
        try:
            user = await get_user_from_identity_service(
                request.cookies.get("auth_token") or ""
            )

            response = self.templates.TemplateResponse(
                "profiles_list.html",
                {"request": request, "profiles": user.profiles if user else []},
            )
            return HTMLResponse(
                content=self._decode_body(response.body), status_code=200
            )
        except HTTPException as e:
            if e.status_code == 401:
                return RedirectResponse(url="/", status_code=302)

            raise e
        except (ValueError, TypeError) as e:
            logger.error("Profiles list error: %s", e)
            return HTMLResponse("Error loading profiles.", status_code=500)

    async def create_profile(self, request: Request) -> HTMLResponse | RedirectResponse:
        """Handle profile creation (HTMX endpoint)."""
        try:
            form_data = await request.form()
            name = str(form_data.get("name", ""))  # Ensure string type

            if not name:
                return HTMLResponse("Profile name is required.", status_code=400)

            # Create profile
            await create_profile(request.cookies.get("auth_token") or "", name)

            # Return updated profiles list
            return await self.profiles_list(request)

        except (ValueError, TypeError) as e:
            logger.error("Create profile error: %s", e)
            return HTMLResponse("Error creating profile.", status_code=500)
