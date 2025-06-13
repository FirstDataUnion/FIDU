"""
This file is used to serve the front end of the application, handling htmx interactions
and passing requests to the main APIs when required.
"""

from typing import Annotated
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fidu_core.users import UserAPI
from fidu_core.users.schema import LoginRequest

templates = Jinja2Templates(directory="src/fidu_core/front_end/templates")


class FrontEndAPI:
    """
    This class is used to serve the front end of the application.
    It is responsible for serving the login page and the profile page.
    """

    def __init__(self, app: FastAPI, user_api: UserAPI):
        """Initialize the front end API with FastAPI app and user API instances."""
        self.app = app
        self.user_api = user_api
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
            "/example",
            self.example_template,
            methods=["GET"],
            response_class=HTMLResponse,
            tags=["front_end"],
        )

    async def login(
        self, email: Annotated[str, Form()], password: Annotated[str, Form()]
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
                Welcome {user_name}! Loading your data...
            </div>
            """
            return HTMLResponse(content=html_content, status_code=200)
        except HTTPException as e:
            if e.status_code == 401:
                return HTMLResponse(
                    content="<div class='failure-response'>Incorrect email or password</div>",
                    status_code=200,
                )

            return HTMLResponse(
                content=f"<div class='failure-response'>Error: {e.detail}</div>",
                status_code=e.status_code,
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

    async def example_template(self, request: Request):
        """Render an example template with various context variables."""
        # Create a context dictionary with the variables you want to pass to the template
        context = {
            "request": request,  # Always include the request object
            "title": "Example Page",
            "items": ["Item 1", "Item 2", "Item 3"],
            "user": {"name": "John Doe", "role": "Admin"},
        }

        # Render the template with the context
        return templates.TemplateResponse("example.html", context)
