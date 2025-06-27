"""
This file is used to serve the front end of the application, handling htmx interactions
and passing requests to the service layers when required.
"""

import uuid
from typing import Annotated, Optional
from datetime import datetime
from fastapi import FastAPI, Request, Form, HTTPException, Query
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fidu_core.security import PasswordHasher, JWTManager
from fidu_core.users.service import UserService
from fidu_core.users.schema import (
    LoginRequest,
    CreateUserRequest,
    UserBase,
    UserInternal,
)
from fidu_core.data_packets.service import DataPacketService
from fidu_core.data_packets.schema import (
    DataPacketQueryParams,
    DataPacketQueryParamsInternal,
)
from fidu_core.profiles.service import ProfileService
from fidu_core.profiles.schema import (
    ProfileQueryParamsInternal,
    ProfileInternal,
    CreateProfileRequest,
    UpdateProfileRequest,
)

templates = Jinja2Templates(directory="src/fidu_core/front_end/templates")


class FrontEndAPI:
    """
    This class is used to serve the front end of the application.
    It is responsible for serving the login page and the profile page.
    """

    def __init__(
        self,
        app: FastAPI,
        user_service: UserService,
        data_packet_service: DataPacketService,
        profile_service: ProfileService,
    ):
        """Initialize the front end API with FastAPI app and service instances."""
        self.app = app
        self.user_service = user_service
        self.data_packet_service = data_packet_service
        self.profile_service = profile_service
        self.password_hasher = PasswordHasher()
        self.jwt_manager = JWTManager()
        self._setup_routes()

    def _setup_routes(self) -> None:
        """Set up the API routes for the front end."""
        self.app.add_api_route(
            "/login",
            self.login,
            methods=["POST"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )
        self.app.add_api_route(
            "/auth",
            self.auth,
            methods=["GET"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )
        self.app.add_api_route(
            "/data_packet_viewer",
            self.data_packet_viewer,
            methods=["GET"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )
        self.app.add_api_route(
            "/data-packets/list",
            self.list_data_packets_htmx,
            methods=["GET"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )
        self.app.add_api_route(
            "/open_signup",
            self.open_signup,
            methods=["GET"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )
        self.app.add_api_route(
            "/signup",
            self.signup,
            methods=["POST"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )
        self.app.add_api_route(
            "/logout",
            self.logout,
            methods=["POST"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )
        # New profiles routes
        self.app.add_api_route(
            "/profiles",
            self.profiles,
            methods=["GET"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )
        self.app.add_api_route(
            "/profiles/list",
            self.list_profiles_htmx,
            methods=["GET"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )
        self.app.add_api_route(
            "/profiles/create",
            self.create_profile,
            methods=["POST"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )
        self.app.add_api_route(
            "/profiles/update",
            self.update_profile,
            methods=["PUT"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )
        self.app.add_api_route(
            "/profiles/delete/{profile_id}",
            self.delete_profile,
            methods=["DELETE"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )
        self.app.add_api_route(
            "/user-info",
            self.user_info,
            methods=["GET"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )
        self.app.add_api_route(
            "/test-auth",
            self.test_auth,
            methods=["GET"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )

    def _get_user_from_token(self, access_token: str) -> UserInternal:
        """Helper method to get user from JWT token."""
        token_data = self.jwt_manager.verify_token_or_raise(access_token)
        user_id = token_data.user_id
        return self.user_service.get_user(user_id)

    async def login(
        self,
        request: Request,
        email: Annotated[str, Form()],
        password: Annotated[str, Form()],
    ):
        """Handle user login requests and return appropriate HTML response."""
        try:
            # Get user by email
            user = self.user_service.get_user_by_email(email)

            # Verify password
            if not self.password_hasher.verify_password(password, user.password_hash):
                raise HTTPException(status_code=401, detail="Invalid email or password")

            # Create access token
            access_token = self.jwt_manager.create_access_token(data={"sub": user.id})

            # Return success response with token
            html_content = f"""
            <div 
                hx-get="/data_packet_viewer" 
                hx-target="#content" 
                hx-trigger="load" 
                hx-swap="innerHTML">
                <div class="text-center py-8">
                    <div class="rounded-md bg-green-50 p-4 mb-4">
                        <div class="flex">
                            <div class="flex-shrink-0">
                                <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                </svg>
                            </div>
                            <div class="ml-3">
                                <p class="text-sm font-medium text-green-800">Login successful! Welcome back, {user.first_name}.</p>
                            </div>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600">Redirecting to dashboard...</p>
                </div>
            </div>
            """
            response = HTMLResponse(content=html_content, status_code=200)
            # Set the access token as an HTTP-only cookie
            response.set_cookie(
                key="access_token",
                value=access_token,
                httponly=False,  # Allow JavaScript access for debugging
                secure=False,  # Set to True in production with HTTPS
                samesite="lax",
                max_age=3600,  # 1 hour expiration
                path="/",  # Ensure cookie is available for all paths
            )
            return response
        except HTTPException:
            raise
        except Exception as e:
            # Handle user not found or other service exceptions
            return templates.TemplateResponse(
                "login.html",
                {
                    "request": request,
                    "error_message": "Incorrect email or password",
                    "email": email,
                    "password": password,
                },
            )

    async def open_signup(self, request: Request):
        """Handle signup requests and return appropriate HTML response."""
        return templates.TemplateResponse("sign_up.html", {"request": request})

    async def signup(
        self,
        request: Request,
        first_name: Annotated[str, Form()],
        last_name: Annotated[str, Form()],
        email: Annotated[str, Form()],
        password: Annotated[str, Form()],
        confirm_password: Annotated[str, Form()],
    ):
        """Handle signup requests and return appropriate HTML response."""

        # Dict of variables used to recreate the signup form if needed.
        template_context = {
            "request": request,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "password": password,
            "confirm_password": confirm_password,
        }

        if password != confirm_password:
            return templates.TemplateResponse(
                "sign_up.html",
                {
                    "request": request,
                    "password_error_message": "Passwords do not match",
                    **template_context,
                },
            )

        try:
            # Create internal user with hashed password
            internal_user = UserInternal(
                id=str(uuid.uuid4()),
                first_name=first_name,
                last_name=last_name,
                email=email,
                password_hash=self.password_hasher.hash_password(password),
            )

            # Create user in service layer
            request_id = str(uuid.uuid4())
            created_user = self.user_service.create_user(request_id, internal_user)

            # Create access token for immediate login
            access_token = self.jwt_manager.create_access_token(
                data={"sub": created_user.id}
            )

            # Return success response with token
            html_content = f"""
            <div 
                hx-get="/data_packet_viewer" 
                hx-target="#content" 
                hx-trigger="load" 
                hx-swap="innerHTML">
                <div class="text-center py-8">
                    <div class="rounded-md bg-green-50 p-4 mb-4">
                        <div class="flex">
                            <div class="flex-shrink-0">
                                <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                </svg>
                            </div>
                            <div class="ml-3">
                                <p class="text-sm font-medium text-green-800">Account created successfully! Welcome to FIDU, {created_user.first_name}.</p>
                            </div>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600">Redirecting to dashboard...</p>
                </div>
            </div>
            """
            response = HTMLResponse(content=html_content, status_code=200)
            # Set the access token as an HTTP-only cookie
            response.set_cookie(
                key="access_token",
                value=access_token,
                httponly=False,  # Allow JavaScript access for debugging
                secure=False,  # Set to True in production with HTTPS
                samesite="lax",
                max_age=3600,  # 1 hour expiration
                path="/",  # Ensure cookie is available for all paths
            )
            return response

        except Exception as e:
            # Handle user already exists or other errors
            return templates.TemplateResponse(
                "sign_up.html",
                {
                    "request": request,
                    "email_error_message": "User already exists",
                    **template_context,
                },
            )

    async def auth(self, request: Request):
        """Handle authentication requests and return appropriate HTML response."""
        # Check to see if the user is authenticated
        access_token = request.cookies.get("access_token")
        if access_token:
            try:
                user = self._get_user_from_token(access_token)

                # Return a response that triggers the main app display
                html_content = f"""
                <div 
                    hx-get="/data_packet_viewer" 
                    hx-target="#content" 
                    hx-trigger="load" 
                    hx-swap="innerHTML"
                    data-user-name="{user.first_name}">
                    <div class="text-center py-8">
                        <div class="rounded-md bg-green-50 p-4 mb-4">
                            <div class="flex">
                                <div class="flex-shrink-0">
                                    <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                    </svg>
                                </div>
                                <div class="ml-3">
                                    <p class="text-sm font-medium text-green-800">Welcome back, {user.first_name}!</p>
                                </div>
                            </div>
                        </div>
                        <p class="text-sm text-gray-600">Loading your dashboard...</p>
                    </div>
                </div>
                """
                return HTMLResponse(content=html_content, status_code=200)

            except HTTPException as e:
                if e.status_code == 401:
                    return templates.TemplateResponse(
                        "login.html", {"request": request}
                    )

                return HTMLResponse(
                    content=f"<div>Error: {e.detail}</div>", status_code=401
                )

        return templates.TemplateResponse("login.html", {"request": request})

    async def logout(self, request: Request):
        """Handle user logout by clearing the access token cookie."""
        response = HTMLResponse(content="<div>Logged out successfully</div>")
        # Clear the access token cookie
        response.delete_cookie(key="access_token")
        return response

    def data_packet_viewer(self, request: Request):
        """Render the data packet viewer template."""
        # Check authentication
        access_token = request.cookies.get("access_token")
        print(f"Data packet viewer - All cookies: {request.cookies}")
        print(f"Data packet viewer - Access token: {access_token}")

        if not access_token:
            print("No access token found in cookies")
            raise HTTPException(status_code=401, detail="Authentication required")

        try:
            user = self._get_user_from_token(access_token)
            print(f"User authenticated: {user.first_name}")
            return templates.TemplateResponse(
                "data_packet_viewer.html", {"request": request}
            )
        except Exception as e:
            print(f"Authentication error: {str(e)}")
            raise HTTPException(status_code=401, detail="Authentication required")

    def profiles(self, request: Request):
        """Render the profiles template."""
        # Check authentication
        access_token = request.cookies.get("access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="Authentication required")

        try:
            user = self._get_user_from_token(access_token)
            return templates.TemplateResponse("profiles.html", {"request": request})
        except Exception as e:
            raise HTTPException(status_code=401, detail="Authentication required")

    async def user_info(self, request: Request):
        """Get user information for the welcome message."""
        try:
            # Get user from token
            access_token = request.cookies.get("access_token")
            if not access_token:
                raise HTTPException(status_code=401, detail="Authentication required")

            user = self._get_user_from_token(access_token)

            # Return user welcome message
            return HTMLResponse(content=f"Welcome, {user.first_name}!")

        except HTTPException as e:
            return HTMLResponse(content="Welcome!", status_code=200)
        except Exception as e:
            return HTMLResponse(content="Welcome!", status_code=200)

    async def list_profiles_htmx(self, request: Request):
        """HTMX endpoint for listing profiles."""
        try:
            # Get user from token
            access_token = request.cookies.get("access_token")
            if not access_token:
                raise HTTPException(status_code=401, detail="Authentication required")

            user = self._get_user_from_token(access_token)

            # Create internal query parameters with user_id
            query_params = ProfileQueryParamsInternal(
                user_id=user.id, limit=50, offset=0, sort_order="desc"
            )

            # Get profiles directly from service
            profiles = self.profile_service.list_profiles(query_params)

            # Prepare context for template
            context = {
                "request": request,
                "profiles": profiles,
            }

            return templates.TemplateResponse("profiles_list.html", context)

        except HTTPException as e:
            return HTMLResponse(
                content=f"<div class='error'>Error loading profiles: {str(e)}</div>",
                status_code=500,
            )

    async def create_profile(
        self,
        request: Request,
        name: Annotated[str, Form()],
    ):
        """Handle profile creation."""
        try:
            # Get user from token
            access_token = request.cookies.get("access_token")
            if not access_token:
                raise HTTPException(status_code=401, detail="Authentication required")

            user = self._get_user_from_token(access_token)

            # Create profile request
            profile_create = ProfileInternal(
                id=str(uuid.uuid4()),
                user_id=user.id,
                name=name,
            )

            request_id = str(uuid.uuid4())
            created_profile = self.profile_service.create_profile(
                request_id, profile_create
            )

            # Return updated profiles list
            return await self.list_profiles_htmx(request)

        except Exception as e:
            return HTMLResponse(
                content=f"<div class='error'>Error creating profile: {str(e)}</div>",
                status_code=500,
            )

    async def update_profile(
        self,
        request: Request,
        profile_id: Annotated[str, Form()],
        name: Annotated[str, Form()],
    ):
        """Handle profile updates."""
        try:
            # Get user from token
            access_token = request.cookies.get("access_token")
            if not access_token:
                raise HTTPException(status_code=401, detail="Authentication required")

            user = self._get_user_from_token(access_token)

            # Create profile update request
            profile_update = ProfileInternal(
                id=profile_id,
                user_id=user.id,
                name=name,
            )

            request_id = str(uuid.uuid4())
            updated_profile = self.profile_service.update_profile(
                request_id, profile_update
            )

            # Return updated profiles list
            return await self.list_profiles_htmx(request)

        except Exception as e:
            return HTMLResponse(
                content=f"<div class='error'>Error updating profile: {str(e)}</div>",
                status_code=500,
            )

    async def delete_profile(self, request: Request, profile_id: str):
        """Handle profile deletion."""
        try:
            # Get user from token
            access_token = request.cookies.get("access_token")
            if not access_token:
                raise HTTPException(status_code=401, detail="Authentication required")

            user = self._get_user_from_token(access_token)

            # Delete profile
            self.profile_service.delete_profile(user.id, profile_id)

            # Return updated profiles list
            return await self.list_profiles_htmx(request)

        except Exception as e:
            return HTMLResponse(
                content=f"<div class='error'>Error deleting profile: {str(e)}</div>",
                status_code=500,
            )

    # Need to disable the linter for this one as there's no way to avoid
    # lots of args being passed from the form.
    # pylint: disable=too-many-locals
    async def list_data_packets_htmx(
        self,
        request: Request,
        tags: Optional[str] = Query(None, description="Comma-separated list of tags"),
        profile_id: Optional[str] = Query(None, description="Filter by profile ID"),
        from_timestamp: Optional[str] = Query(
            None, description="Filter by start timestamp (ISO format)"
        ),
        to_timestamp: Optional[str] = Query(
            None, description="Filter by end timestamp (ISO format)"
        ),
        limit: int = Query(50, ge=1, le=100, description="Number of results to return"),
        offset: int = Query(0, ge=0, description="Number of results to skip"),
        sort_order: str = Query("desc", description="Sort order (asc/desc)"),
    ):
        """HTMX endpoint for listing data packets with filtering."""
        try:
            # Get user from token
            access_token = request.cookies.get("access_token")
            if not access_token:
                raise HTTPException(status_code=401, detail="Authentication required")

            user = self._get_user_from_token(access_token)

            # Parse tags from comma-separated string
            tag_list = None
            if tags:
                tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]

            # Parse timestamps
            from_dt = None
            to_dt = None
            if from_timestamp:
                from_dt = datetime.fromisoformat(from_timestamp.replace("Z", "+00:00"))
            if to_timestamp:
                to_dt = datetime.fromisoformat(to_timestamp.replace("Z", "+00:00"))

            # Create internal query parameters with user_id
            query_params = DataPacketQueryParamsInternal(
                user_id=user.id,
                tags=tag_list,
                profile_id=profile_id,
                from_timestamp=from_dt,
                to_timestamp=to_dt,
                limit=limit,
                offset=offset,
                sort_order=sort_order,
            )

            # Get data packets directly from service
            data_packets = self.data_packet_service.list_data_packets(query_params)

            # Prepare context for template
            context = {
                "request": request,
                "data_packets": data_packets,
                "filters": {
                    "tags": tags or "",
                    "profile_id": profile_id or "",
                    "from_timestamp": from_timestamp or "",
                    "to_timestamp": to_timestamp or "",
                    "limit": limit,
                    "offset": offset,
                    "sort_order": sort_order,
                },
                "total_count": len(data_packets),
            }

            return templates.TemplateResponse("data_packet_list.html", context)

        except HTTPException as e:
            return HTMLResponse(
                content=f"<div class='error'>Error loading data packets: {str(e)}</div>",
                status_code=500,
            )

    async def test_auth(self, request: Request):
        """Test endpoint to verify authentication is working."""
        try:
            access_token = request.cookies.get("access_token")
            if not access_token:
                return HTMLResponse(content="No token found", status_code=401)

            user = self._get_user_from_token(access_token)
            return HTMLResponse(
                content=f"Authenticated as: {user.first_name} {user.last_name}"
            )

        except Exception as e:
            return HTMLResponse(content=f"Auth error: {str(e)}", status_code=401)
