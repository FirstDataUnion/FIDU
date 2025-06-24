"""
This file is used to serve the front end of the application, handling htmx interactions
and passing requests to the main APIs when required.
"""

import uuid
from typing import Annotated, Optional
from datetime import datetime
from fastapi import FastAPI, Request, Form, HTTPException, Query
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fidu_core.users import UserAPI
from fidu_core.users.schema import LoginRequest, CreateUserRequest, UserBase
from fidu_core.data_packets import DataPacketAPI
from fidu_core.data_packets.schema import DataPacketQueryParams

templates = Jinja2Templates(directory="src/fidu_core/front_end/templates")


class FrontEndAPI:
    """
    This class is used to serve the front end of the application.
    It is responsible for serving the login page and the profile page.
    """

    def __init__(self, app: FastAPI, user_api: UserAPI, data_packet_api: DataPacketAPI):
        """Initialize the front end API with FastAPI app and user API instances."""
        self.app = app
        self.user_api = user_api
        self.data_packet_api = data_packet_api
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

    async def login(
        self,
        request: Request,
        email: Annotated[str, Form()],
        password: Annotated[str, Form()],
    ):
        """Handle user login requests and return appropriate HTML response."""
        try:
            login_request = LoginRequest(email=email, password=password)
            login_response = await self.user_api.login_user(login_request)
            access_token = login_response.access_token
            user_name = login_response.user.first_name
            html_content = f"""
            <div 
            access_token={access_token}
            hx-get='/data_packet_viewer' 
            hx-target='#content' 
            hx-trigger='load' 
            hx-swap='innerHTML'>
                Welcome back {user_name}!
            </div>
            """
            return HTMLResponse(content=html_content, status_code=200)
        except HTTPException as e:
            if e.status_code == 401:
                return templates.TemplateResponse(
                    "login.html",
                    {
                        "request": request,
                        "error_message": "Incorrect email or password",
                        "email": email,
                        "password": password,
                    },
                )

            return HTMLResponse(
                content=f"<div class='failure-response'>Error: {e.detail}</div>",
                status_code=e.status_code,
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

        create_user_request = CreateUserRequest(
            request_id=str(uuid.uuid4()),
            password=password,
            user=UserBase(
                first_name=first_name,
                last_name=last_name,
                email=email,
            ),
        )

        try:
            create_user_response = await self.user_api.create_user(create_user_request)
        except HTTPException as e:
            if e.status_code == 400:
                return templates.TemplateResponse(
                    "sign_up.html",
                    {
                        "request": request,
                        "email_error_message": "User already exists",
                        **template_context,
                    },
                )
        return templates.TemplateResponse(
            "login.html",
            {
                "request": request,
                "message": f"Account created successfully, ID: {create_user_response.id}",
            },
        )

    async def auth(self, request: Request):
        """Handle authentication requests and return appropriate HTML response."""
        # Check to see if the user is authenticated
        access_token = request.cookies.get("access_token")
        if access_token:
            try:
                user = await self.user_api.get_current_user(access_token)
                print(f"User: {user}")
            except HTTPException as e:
                if e.status_code == 401:
                    return templates.TemplateResponse(
                        "login.html", {"request": request}
                    )

                return HTMLResponse(
                    content=f"<div>Error: {e.detail}</div>", status_code=401
                )

            html_content = f"""
            <div 
            access_token={access_token}
            hx-get='/data_packet_viewer' 
            hx-target='#content' 
            hx-trigger='load' 
            hx-swap='innerHTML'>
                Welcome back {user.first_name}! Loading your data...
            </div>
            """
            return HTMLResponse(
                content=html_content,
                status_code=200,
            )

        return templates.TemplateResponse("login.html", {"request": request})

    def data_packet_viewer(self, request: Request):
        """Render the data packet viewer template."""
        return templates.TemplateResponse(
            "data_packet_viewer.html", {"request": request}
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

            # Create query parameters
            query_params = DataPacketQueryParams(
                tags=tag_list,
                profile_id=profile_id,
                from_timestamp=from_dt,
                to_timestamp=to_dt,
                limit=limit,
                offset=offset,
                sort_order=sort_order,
            )

            # Get data packets from service
            data_packets = await self.data_packet_api.list_data_packets(query_params)

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
