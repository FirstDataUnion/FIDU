"""Frontend API for HTMX-based user interface."""

import uuid
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
from fidu_core.users.service import UserService
from fidu_core.users.schema import CreateUserRequest, UserInternal, UserBase
from fidu_core.users.exceptions import UserNotFoundError, UserError
from fidu_core.data_packets.service import DataPacketService
from fidu_core.data_packets.schema import DataPacketQueryParamsInternal
from fidu_core.data_packets.exceptions import DataPacketError
from fidu_core.profiles.service import ProfileService
from fidu_core.profiles.schema import (
    CreateProfileRequest,
    ProfileInternal,
    ProfileQueryParamsInternal,
    ProfileCreate,
)
from fidu_core.profiles.exceptions import ProfileError


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
        user_service: UserService,
        data_packet_service: DataPacketService,
        profile_service: ProfileService,
    ) -> None:
        """Initialize the frontend API.

        Args:
            app: The FastAPI app to mount the API on
            user_service: The user service layer
            data_packet_service: The data packet service layer
            profile_service: The profile service layer
        """
        self.app = app
        self.user_service = user_service
        self.data_packet_service = data_packet_service
        self.profile_service = profile_service
        self.jwt_manager = JWTManager()
        self.password_hasher = PasswordHasher()

        templates_dir = BASE_PATH / "fidu_core" / "front_end" / "templates"

        self.templates = Jinja2Templates(directory=str(templates_dir))
        self._setup_routes()

    def _setup_routes(self) -> None:
        """Set up the frontend routes."""
        # Authentication routes
        self.app.add_api_route(
            "/",
            self.home,
            methods=["GET"],
            response_model=None,
        )
        self.app.add_api_route(
            "/login",
            self.login_page,
            methods=["GET"],
            response_class=HTMLResponse,
        )
        self.app.add_api_route(
            "/login",
            self.login,
            methods=["POST"],
            response_model=None,
        )
        self.app.add_api_route(
            "/register",
            self.register_page,
            methods=["GET"],
            response_class=HTMLResponse,
        )
        self.app.add_api_route(
            "/register",
            self.register,
            methods=["POST"],
            response_model=None,
        )
        self.app.add_api_route(
            "/logout",
            self.logout,
            methods=["POST"],
            response_model=None,
        )

        # Main application routes
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
            response_class=HTMLResponse,
        )
        self.app.add_api_route(
            "/data-packets/delete",
            self.delete_data_packet,
            methods=["DELETE"],
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
            response_class=HTMLResponse,
        )
        self.app.add_api_route(
            "/profiles/create",
            self.create_profile,
            methods=["POST"],
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
                token_data = self.jwt_manager.verify_token_or_raise(token)
                return token_data.user_id
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

    async def home(self, request: Request) -> Union[HTMLResponse, RedirectResponse]:
        """Serve the home page with login/register options."""
        user_id = await self._get_current_user_id(request)

        if user_id:
            # User is logged in, redirect to dashboard
            return RedirectResponse(url="/dashboard", status_code=302)

        response = self.templates.TemplateResponse(
            "home.html", {"request": request, "error": None}
        )
        return HTMLResponse(content=response.body.decode(), status_code=200)

    async def login_page(self, request: Request) -> HTMLResponse:
        """Serve the login page."""
        response = self.templates.TemplateResponse(
            "login.html", {"request": request, "error": None}
        )
        return HTMLResponse(content=response.body.decode(), status_code=200)

    async def login(self, request: Request) -> Union[HTMLResponse, RedirectResponse]:
        """Handle user login."""
        try:
            form_data = await request.form()
            email = form_data.get("email")
            password = form_data.get("password")

            if not email or not password:
                response = self.templates.TemplateResponse(
                    "login.html",
                    {"request": request, "error": "Email and password are required"},
                )
                return HTMLResponse(content=response.body.decode(), status_code=200)

            # Get user by email
            try:
                internal_user = self.user_service.get_user_by_email(str(email))
            except (UserNotFoundError, UserError):
                response = self.templates.TemplateResponse(
                    "login.html",
                    {"request": request, "error": "Invalid email or password"},
                )
                return HTMLResponse(content=response.body.decode(), status_code=200)

            # Verify password
            if not self.password_hasher.verify_password(
                str(password), internal_user.password_hash
            ):
                response = self.templates.TemplateResponse(
                    "login.html",
                    {"request": request, "error": "Invalid email or password"},
                )
                return HTMLResponse(content=response.body.decode(), status_code=200)

            # Generate JWT token
            token = self.jwt_manager.create_access_token(data={"sub": internal_user.id})

            # Create response with redirect to dashboard
            redirect_response = RedirectResponse(url="/dashboard", status_code=302)
            redirect_response.set_cookie(
                key="auth_token",
                value=token,
                httponly=True,
                secure=False,  # Set to True in production with HTTPS
                samesite="lax",
                max_age=3600,  # 1 hour
            )
            return redirect_response

        except (UserError, DataPacketError, ProfileError, ValueError, TypeError) as e:
            logger.error("Login error: %s", e)
            response = self.templates.TemplateResponse(
                "login.html",
                {"request": request, "error": "An error occurred during login"},
            )
            return HTMLResponse(content=response.body.decode(), status_code=200)

    async def register_page(self, request: Request) -> HTMLResponse:
        """Serve the register page."""
        response = self.templates.TemplateResponse(
            "register.html", {"request": request, "error": None}
        )
        return HTMLResponse(content=response.body.decode(), status_code=200)

    async def register(self, request: Request) -> Union[HTMLResponse, RedirectResponse]:
        """Handle user registration."""
        try:
            form_data = await request.form()
            email = form_data.get("email")
            first_name = form_data.get("first_name")
            last_name = form_data.get("last_name")
            password = form_data.get("password")
            confirm_password = form_data.get("confirm_password")

            if not email or not password or not confirm_password:
                response = self.templates.TemplateResponse(
                    "register.html",
                    {"request": request, "error": "All fields are required"},
                )
                return HTMLResponse(content=response.body.decode(), status_code=200)

            if password != confirm_password:
                response = self.templates.TemplateResponse(
                    "register.html",
                    {"request": request, "error": "Passwords do not match"},
                )
                return HTMLResponse(content=response.body.decode(), status_code=200)

            # Create user
            user_create = UserBase(
                email=str(email), first_name=str(first_name), last_name=str(last_name)
            )
            create_request = CreateUserRequest(
                request_id=str(uuid.uuid4()), user=user_create, password=str(password)
            )

            internal_user = self.user_service.create_user(
                create_request.request_id,
                UserInternal(
                    id=str(uuid.uuid4()),
                    email=str(email),
                    password_hash=self.password_hasher.hash_password(str(password)),
                ),
            )

            # Generate JWT token
            token = self.jwt_manager.create_access_token(data={"sub": internal_user.id})

            # Create response with redirect to dashboard
            redirect_response = RedirectResponse(url="/dashboard", status_code=302)
            redirect_response.set_cookie(
                key="auth_token",
                value=token,
                httponly=True,
                secure=False,  # Set to True in production with HTTPS
                samesite="lax",
                max_age=3600,  # 1 hour
            )
            return redirect_response

        except (UserError, DataPacketError, ProfileError, ValueError, TypeError) as e:
            logger.error("Registration error: %s", e)
            response = self.templates.TemplateResponse(
                "register.html",
                {"request": request, "error": "An error occurred during registration"},
            )
            return HTMLResponse(content=response.body.decode(), status_code=200)

    # pylint: disable=unused-argument
    async def logout(self, request: Request) -> Union[HTMLResponse, RedirectResponse]:
        """Handle user logout."""
        response = RedirectResponse(url="/", status_code=302)
        response.delete_cookie("auth_token")
        response.delete_cookie("session_data")
        return response

    async def dashboard(
        self, request: Request
    ) -> Union[HTMLResponse, RedirectResponse]:
        """Serve the main dashboard."""
        user_id = await self._get_current_user_id(request)

        if not user_id:
            return RedirectResponse(url="/login", status_code=302)

        try:
            user = self.user_service.get_user(user_id)
            response = self.templates.TemplateResponse(
                "dashboard.html", {"request": request, "user": user}
            )
            return HTMLResponse(content=response.body.decode(), status_code=200)
        except (UserNotFoundError, UserError) as e:
            logger.error("Dashboard error: %s", e)
            return RedirectResponse(url="/login", status_code=302)

    async def data_packets_page(
        self, request: Request
    ) -> Union[HTMLResponse, RedirectResponse]:
        """Serve the data packets page."""
        user_id = await self._get_current_user_id(request)

        if not user_id:
            return RedirectResponse(url="/login", status_code=302)

        try:
            user = self.user_service.get_user(user_id)
            response = self.templates.TemplateResponse(
                "data_packets.html", {"request": request, "user": user}
            )
            return HTMLResponse(content=response.body.decode(), status_code=200)
        except (UserNotFoundError, UserError) as e:
            logger.error("Data packets page error: %s", e)
            return RedirectResponse(url="/login", status_code=302)

    async def data_packets_list(self, request: Request) -> HTMLResponse:
        """Serve the data packets list (HTMX endpoint)."""
        user_id = await self._get_current_user_id(request)

        if not user_id:
            return HTMLResponse("Please log in to view data packets.", status_code=401)

        try:
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
            try:
                profile_query = ProfileQueryParamsInternal(
                    user_id=user_id, limit=100, offset=0
                )
                available_profiles = self.profile_service.list_profiles(profile_query)
            except (ProfileError, ValueError, TypeError):
                available_profiles = []

            # Create query params for service
            query_params_internal = DataPacketQueryParamsInternal(
                user_id=user_id,
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
            return HTMLResponse(content=response.body.decode(), status_code=200)
        except (DataPacketError, ProfileError, ValueError, TypeError) as e:
            logger.error("Data packets list error: %s", e)
            return HTMLResponse("Error loading data packets.", status_code=500)

    async def delete_data_packet(self, request: Request) -> HTMLResponse:
        """Handle data packet deletion (HTMX endpoint)."""
        user_id = await self._get_current_user_id(request)

        if not user_id:
            return HTMLResponse(
                "Please log in to delete data packets.", status_code=401
            )

        try:
            data_packet_id = request.query_params.get("data_packet_id")

            if not data_packet_id:
                return HTMLResponse("Data packet ID is required.", status_code=400)

            self.data_packet_service.delete_data_packet(user_id, data_packet_id)

            return HTMLResponse("Data packet deleted successfully.", status_code=200)

        except (DataPacketError, ValueError, TypeError) as e:
            logger.error("Delete data packet error: %s", e)
            return HTMLResponse("Error deleting data packet.", status_code=500)

    async def profiles_page(
        self, request: Request
    ) -> Union[HTMLResponse, RedirectResponse]:
        """Serve the profiles page."""
        user_id = await self._get_current_user_id(request)

        if not user_id:
            return RedirectResponse(url="/login", status_code=302)

        try:
            user = self.user_service.get_user(user_id)
            response = self.templates.TemplateResponse(
                "profiles.html", {"request": request, "user": user}
            )
            return HTMLResponse(content=response.body.decode(), status_code=200)
        except (UserNotFoundError, UserError) as e:
            logger.error("Profiles page error: %s", e)
            return RedirectResponse(url="/login", status_code=302)

    async def apps_page(
        self, request: Request
    ) -> Union[HTMLResponse, RedirectResponse]:
        """Serve the apps page."""
        user_id = await self._get_current_user_id(request)

        if not user_id:
            return RedirectResponse(url="/login", status_code=302)

        try:
            user = self.user_service.get_user(user_id)
            response = self.templates.TemplateResponse(
                "apps.html", {"request": request, "user": user}
            )
            return HTMLResponse(content=response.body.decode(), status_code=200)
        except (UserNotFoundError, UserError) as e:
            logger.error("Apps page error: %s", e)
            return RedirectResponse(url="/login", status_code=302)

    async def profiles_list(self, request: Request) -> HTMLResponse:
        """Serve the profiles list (HTMX endpoint)."""
        user_id = await self._get_current_user_id(request)

        if not user_id:
            return HTMLResponse("Please log in to view profiles.", status_code=401)

        try:
            # Get query parameters for filtering
            name = request.query_params.get("name")
            limit = int(request.query_params.get("limit", 50))
            offset = int(request.query_params.get("offset", 0))

            # Create query params for service
            query_params = ProfileQueryParamsInternal(
                user_id=user_id, name=name if name else None, limit=limit, offset=offset
            )

            profiles = self.profile_service.list_profiles(query_params)

            response = self.templates.TemplateResponse(
                "profiles_list.html", {"request": request, "profiles": profiles}
            )
            return HTMLResponse(content=response.body.decode(), status_code=200)
        except (ProfileError, ValueError, TypeError) as e:
            logger.error("Profiles list error: %s", e)
            return HTMLResponse("Error loading profiles.", status_code=500)

    async def create_profile(self, request: Request) -> HTMLResponse:
        """Handle profile creation (HTMX endpoint)."""
        user_id = await self._get_current_user_id(request)

        if not user_id:
            return HTMLResponse("Please log in to create profiles.", status_code=401)

        try:
            form_data = await request.form()
            name = form_data.get("name")

            if not name:
                return HTMLResponse("Profile name is required.", status_code=400)

            # Create profile
            profile_create = ProfileCreate(name=str(name), user_id=str(user_id))
            create_request = CreateProfileRequest(
                request_id=str(uuid.uuid4()), profile=profile_create
            )

            profile_internal = ProfileInternal(
                id=str(uuid.uuid4()), user_id=str(user_id), name=str(name)
            )

            self.profile_service.create_profile(
                create_request.request_id, profile_internal
            )

            # Return updated profiles list
            return await self.profiles_list(request)

        except (ProfileError, ValueError, TypeError) as e:
            logger.error("Create profile error: %s", e)
            return HTMLResponse("Error creating profile.", status_code=500)
