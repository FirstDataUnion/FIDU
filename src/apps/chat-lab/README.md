# FIDU Chat Lab

A React-based chat application for managing conversations and AI interactions.

## Environment Configuration

### Development
For development, you can create a `.env` file in the root directory:

```bash
# Development environment
VITE_IDENTITY_SERVICE_URL=https://dev.identity.firstdataunion.org
VITE_GATEWAY_URL=https://dev.gateway.firstdataunion.org
```

### Production
For production builds, ensure the correct URLs are set:

```bash
# Production environment
VITE_IDENTITY_SERVICE_URL=https://identity.firstdataunion.org
VITE_GATEWAY_URL=https://gateway.firstdataunion.org
```

### Gateway Service
The application now routes all NLP Workbench API calls through a gateway service:
- **Production Gateway**: `https://gateway.firstdataunion.org/api/`
- **Development Gateway**: `https://dev.gateway.firstdataunion.org/api/`

All NLP Workbench requests are automatically prefixed with `/api/nlp-workbench/` and sent through the configured gateway.

## Building for Production

1. Set the correct environment variables for production
2. Run the build command:
   ```bash
   npm run build
   ```
3. The built files will be in the `dist/` directory

## Authentication Issues

The application now properly handles authentication failures by:
- Clearing all auth tokens on failed login attempts
- Preventing infinite reload loops
- Providing clear error messages to users

## Development

```bash
npm install
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint 