# FIDU Frontend

A modern, responsive web interface for the FIDU data management platform built with HTMX and Tailwind CSS.

## Features

### Authentication
- **Automatic Login Detection**: Users with valid tokens are automatically logged in
- **Seamless Account Creation**: New users are immediately logged in after account creation
- **Secure Token Management**: JWT tokens stored in HTTP-only cookies
- **Clean Login/Signup Forms**: Modern, accessible forms with proper validation

### Navigation
- **Responsive Navigation Bar**: Clean header with user info and logout button
- **Tab-based Navigation**: Easy switching between Data Packet Viewer and Profiles
- **Active State Indicators**: Clear visual feedback for current section

### Data Packet Viewer
- **Advanced Filtering**: Filter by tags, profile ID, date ranges, and more
- **Real-time Updates**: Auto-refresh every 30 seconds
- **Modern Card Layout**: Clean, organized display of data packets
- **Interactive Actions**: View details and delete packets with confirmation
- **Responsive Design**: Works on desktop, tablet, and mobile devices

### Profiles Management
- **Profile Creation**: Modal-based profile creation with validation
- **Profile Editing**: Inline editing with modal forms
- **Profile Deletion**: Confirmation-based deletion
- **Grid Layout**: Responsive grid display of user profiles
- **Empty State Handling**: Helpful guidance when no profiles exist

## Technical Stack

- **HTMX 2.0**: For dynamic content loading and interactions
- **Tailwind CSS**: For modern, responsive styling
- **FastAPI**: Backend API with Jinja2 templating
- **JWT Authentication**: Secure token-based authentication
- **SQLite**: Local data storage

## File Structure

```
front_end/
├── templates/
│   ├── index.html              # Main application layout
│   ├── login.html              # Login form
│   ├── sign_up.html            # Signup form
│   ├── data_packet_viewer.html # Data packet viewer interface
│   ├── data_packet_list.html   # Data packet list display
│   ├── profiles.html           # Profiles management interface
│   └── profiles_list.html      # Profiles list display
├── static/
│   └── styles.css              # Custom CSS styles
└── api.py                      # Frontend API endpoints
```

## Usage

### Starting the Application

```bash
cd /path/to/fidu
python -m src.fidu_core.main
```

The application will be available at `http://127.0.0.1:4000`

### User Flow

1. **First Visit**: Users see a clean login form
2. **Account Creation**: New users can create accounts and are immediately logged in
3. **Authentication**: Users with valid tokens are automatically redirected to the dashboard
4. **Navigation**: Users can switch between Data Packet Viewer and Profiles
5. **Data Management**: Full CRUD operations for both data packets and profiles

### Key Features

#### Automatic Authentication
- The frontend checks for existing authentication tokens on page load
- Users with valid tokens are automatically logged in
- Invalid or expired tokens redirect to login

#### Responsive Design
- Mobile-first design approach
- Responsive navigation and layouts
- Touch-friendly interactions

#### Modern UX Patterns
- Loading states with spinners
- Success/error message handling
- Modal dialogs for focused interactions
- Confirmation dialogs for destructive actions

#### HTMX Best Practices
- Progressive enhancement
- Minimal JavaScript
- Server-side rendering
- Real-time updates

## Development

### Adding New Features

1. **New Templates**: Add Jinja2 templates in the `templates/` directory
2. **API Endpoints**: Add new routes in `api.py`
3. **Styling**: Use Tailwind CSS classes or add custom styles to `styles.css`

### Customization

The frontend uses Tailwind CSS for styling, making it easy to customize:
- Colors: Modify the blue theme by changing color classes
- Layout: Adjust spacing and grid layouts
- Components: Extend or modify existing components

### Browser Support

- Modern browsers with ES6+ support
- HTMX 2.0 compatibility
- CSS Grid and Flexbox support

## Security Features

- HTTP-only cookies for token storage
- CSRF protection through HTMX headers
- Input validation and sanitization
- Secure authentication flow
- User permission checks on all operations 