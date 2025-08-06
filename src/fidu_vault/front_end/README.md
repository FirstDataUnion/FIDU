# FIDU Vault Frontend

A modern, lightweight HTMX-based frontend for the FIDU Vault application.

## Features

- **Modern UI**: Built with Tailwind CSS for a clean, responsive design
- **HTMX Integration**: Dynamic content loading without full page refreshes
- **Authentication**: User login/registration with JWT token management
- **Data Management**: View and manage data packets with filtering
- **Profile Management**: Create and manage user profiles
- **Responsive Design**: Works on desktop and mobile devices

## Structure

```
front_end/
├── api.py              # Frontend API routes and handlers
├── templates/          # Jinja2 HTML templates
│   ├── base.html       # Base template with common layout
│   ├── home.html       # Welcome page
│   ├── login.html      # Login form
│   ├── register.html   # Registration form
│   ├── dashboard.html  # Main dashboard
│   ├── data_packets.html      # Data packets page
│   ├── data_packets_list.html # Data packets list (HTMX partial)
│   ├── profiles.html          # Profiles page
│   └── profiles_list.html     # Profiles list (HTMX partial)
└── static/            # Static assets
    ├── css/
    │   └── main.css   # Custom CSS styles
    └── js/
        └── main.js    # Custom JavaScript
```

## Routes

### Authentication
- `GET /` - Home page (redirects to dashboard if logged in)
- `GET /login` - Login page
- `POST /login` - Handle login
- `GET /register` - Registration page
- `POST /register` - Handle registration
- `POST /logout` - Handle logout

### Main Application
- `GET /dashboard` - Main dashboard
- `GET /data-packets` - Data packets page
- `GET /data-packets/list` - Data packets list (HTMX endpoint)
- `GET /profiles` - Profiles page
- `GET /profiles/list` - Profiles list (HTMX endpoint)
- `POST /profiles/create` - Create new profile (HTMX endpoint)

## HTMX Features

The frontend uses HTMX for dynamic content loading:

- **Automatic Loading**: Lists load automatically when pages are visited
- **Form Submissions**: Forms submit via HTMX for seamless updates
- **Filtering**: Real-time filtering of data packets and profiles
- **Loading States**: Built-in loading indicators during requests
- **Error Handling**: Graceful error handling with user feedback

## Styling

- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **Custom CSS**: Additional styles for HTMX interactions and animations
- **Responsive**: Mobile-first design that works on all screen sizes
- **Dark Mode Ready**: CSS structure supports future dark mode implementation

## JavaScript Features

- **Form Validation**: Client-side validation with visual feedback
- **Error Notifications**: Toast-style error and success messages
- **Loading States**: Button loading states during form submissions
- **Smooth Animations**: CSS transitions and animations for better UX

## Security

- **JWT Tokens**: Secure authentication using JWT tokens stored in cookies
- **CSRF Protection**: Built-in CSRF protection through FastAPI
- **Input Validation**: Server-side validation of all inputs
- **Secure Headers**: Proper security headers configured

## Development

To run the frontend locally:

1. Start the main application:
   ```bash
   python -m src.fidu_vault.main
   ```

2. Visit http://127.0.0.1:4000 in your browser

3. Create an account or log in to access the dashboard

## Browser Support

- Modern browsers with ES6+ support
- HTMX 1.9.10+
- Tailwind CSS 3.x

## Future Enhancements

- Dark mode toggle
- Advanced filtering options
- Bulk operations for data packets
- Export functionality
- Real-time notifications
- Offline support with service workers 