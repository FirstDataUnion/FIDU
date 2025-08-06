/**
 * FIDU Authentication SDK
 * 
 * Due to strict CSP, this is a copy of the SDK provided by the identity service
 * help locally. 
 */
class FIDUAuth {
    constructor(options = {}) {
        this.fiduHost = options.fiduHost || 'http://localhost:8080';
        this.origin = options.origin || window.location.origin;
        this.debug = options.debug || false;
        this.token = localStorage.getItem('fiduToken') || null;
        this.user = null;
        this.callbacks = {};
        this.iframe = null;
        
        this.log('FIDU SDK initialized', { 
            fiduHost: this.fiduHost, 
            origin: this.origin,
            hasToken: !!this.token 
        });
        
        // Set up message listener
        this.setupMessageListener();
    }
    
    log(message, data = null) {
        if (this.debug) {
            console.log('[FIDU SDK]', message, data);
        }
    }
    
    setupMessageListener() {
        window.addEventListener('message', (event) => {
            // Security check - verify origin in production
            if (event.origin !== this.fiduHost && this.fiduHost !== 'http://localhost:8080') {
                return;
            }
            
            this.log('Received message', event.data);
            
            switch (event.data.type) {
                case 'FIDU_AUTH_SUCCESS':
                    this.handleAuthSuccess(event.data);
                    break;
                case 'FIDU_AUTH_ERROR':
                    this.handleAuthError(event.data);
                    break;
                case 'FIDU_REGISTER_SUCCESS':
                    this.handleRegisterSuccess(event.data);
                    break;
                case 'FIDU_REGISTER_ERROR':
                    this.handleRegisterError(event.data);
                    break;
                case 'FIDU_WIDGET_READY':
                    this.handleWidgetReady(event.data);
                    break;
                case 'FIDU_SWITCH_TO_LOGIN':
                    this.showLoginWidget();
                    break;
                case 'FIDU_SWITCH_TO_REGISTER':
                    this.showRegisterWidget();
                    break;
            }
        });
    }
    
    handleAuthSuccess(data) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('fiduToken', this.token);
        
        this.log('Authentication successful', this.user);
        
        if (this.callbacks.onAuthSuccess) {
            this.callbacks.onAuthSuccess(this.user, this.token, data.portalUrl);
        }
    }
    
    handleAuthError(data) {
        this.log('Authentication error', data.error);
        
        if (this.callbacks.onAuthError) {
            this.callbacks.onAuthError(data.error);
        }
    }
    
    handleRegisterSuccess(data) {
        this.log('Registration successful', data.user);
        
        if (this.callbacks.onRegisterSuccess) {
            this.callbacks.onRegisterSuccess(data.user, data.message);
        }
    }
    
    handleRegisterError(data) {
        this.log('Registration error', data.error);
        
        if (this.callbacks.onRegisterError) {
            this.callbacks.onRegisterError(data.error);
        }
    }
    
    handleWidgetReady(data) {
        this.log('Widget ready', data.widget);
        
        if (this.callbacks.onWidgetReady) {
            this.callbacks.onWidgetReady(data.widget);
        }
    }
    
    // Create and show login widget
    showLoginWidget(containerId = 'fiduAuthContainer') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('FIDU: Container not found:', containerId);
            return;
        }
        
        const iframe = document.createElement('iframe');
        iframe.src = `${this.fiduHost}/embed/login?origin=${encodeURIComponent(this.origin)}`;
        iframe.width = '100%';
        iframe.height = '400';
        iframe.frameBorder = '0';
        iframe.style.minHeight = '400px';
        
        container.innerHTML = '';
        container.appendChild(iframe);
        
        this.iframe = iframe;
        this.log('Login widget created');
    }
    
    // Create and show register widget
    showRegisterWidget(containerId = 'fiduAuthContainer') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('FIDU: Container not found:', containerId);
            return;
        }
        
        const iframe = document.createElement('iframe');
        iframe.src = `${this.fiduHost}/embed/register?origin=${encodeURIComponent(this.origin)}`;
        iframe.width = '100%';
        iframe.height = '450';
        iframe.frameBorder = '0';
        iframe.style.minHeight = '450px';
        
        container.innerHTML = '';
        container.appendChild(iframe);
        
        this.iframe = iframe;
        this.log('Register widget created');
    }
    
    // Check if user is currently authenticated
    async isAuthenticated() {
        this.log('=== CHECKING AUTHENTICATION ===');
        this.log('Token exists:', !!this.token);
        
        if (!this.token) {
            this.log('No token found, returning false');
            return false;
        }
        
        this.log('Making auth status request...');
        try {
            const response = await fetch(`${this.fiduHost}/api/auth/status`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            this.log('Auth status response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                this.log('Auth status response data:', data);
                
                if (data.authenticated) {
                    this.user = data.user;
                    this.log('User authenticated:', this.user);
                    return true;
                }
            }
            
            // Token is invalid or revoked - clear client-side state without server call
            this.log('Token invalid or revoked, clearing client-side state');
            this.token = null;
            this.user = null;
            localStorage.removeItem('fiduToken');
            this.log('Client-side state cleared');
            return false;
            
        } catch (error) {
            this.log('Auth check failed', error);
            // Clear client-side state on network error too
            this.token = null;
            this.user = null;
            localStorage.removeItem('fiduToken');
            this.log('Client-side state cleared due to error');
            return false;
        }
    }
    
    // Validate a specific token
    async validateToken(token = null) {
        const tokenToValidate = token || this.token;
        
        if (!tokenToValidate) {
            return { valid: false, error: 'No token provided' };
        }
        
        try {
            const response = await fetch(`${this.fiduHost}/api/auth/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: tokenToValidate })
            });
            
            const data = await response.json();
            
            if (data.valid) {
                if (!token) { // If validating current token, update user info
                    this.user = data.user;
                }
                return { valid: true, user: data.user };
            } else {
                return { valid: false, error: data.error };
            }
            
        } catch (error) {
            this.log('Token validation failed', error);
            return { valid: false, error: 'Network error' };
        }
    }
    
    // Get current user info
    getUser() {
        return this.user;
    }
    
    // Get current token
    getToken() {
        return this.token;
    }
    
    // Get portal URL for current user
    getPortalUrl() {
        return `${this.fiduHost}/portal/dashboard`;
    }
    
    // Logout user
    async logout() {
        this.log('=== LOGOUT STARTED ===');
        this.log('Token before logout:', this.token ? 'EXISTS' : 'NULL');
        
        // Only call server-side logout if we have a token and it might be valid
        if (this.token) {
            this.log('Calling server-side logout...');
            try {
                const response = await fetch(`${this.fiduHost}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
                
                this.log('Server logout response status:', response.status);
                const responseData = await response.json();
                this.log('Server logout response data:', responseData);
                
                if (response.ok) {
                    this.log('Server-side logout successful');
                } else {
                    this.log('Server-side logout failed, continuing with client-side logout');
                }
            } catch (error) {
                this.log('Logout API call failed:', error);
            }
        }
        
        // Clear client-side state
        this.log('Clearing client-side state...');
        this.token = null;
        this.user = null;
        localStorage.removeItem('fiduToken');
        
        this.log('Token after clearing:', this.token);
        this.log('User after clearing:', this.user);
        this.log('localStorage fiduToken:', localStorage.getItem('fiduToken'));
        
        this.log('User logged out');
        
        if (this.callbacks.onLogout) {
            this.log('Calling onLogout callback...');
            this.callbacks.onLogout();
        }
        
        this.log('=== LOGOUT COMPLETED ===');
    }
    
    // Set event callbacks
    on(event, callback) {
        const validEvents = [
            'onAuthSuccess',
            'onAuthError', 
            'onRegisterSuccess',
            'onRegisterError',
            'onWidgetReady',
            'onLogout'
        ];
        
        if (validEvents.includes(event)) {
            this.callbacks[event] = callback;
        } else {
            console.warn('FIDU: Invalid event name:', event);
        }
    }
    
    // Initialize authentication flow
    async init() {
        this.log('=== INITIALIZING FIDU AUTHENTICATION ===');
        this.log('Token in localStorage:', localStorage.getItem('fiduToken') ? 'EXISTS' : 'NULL');
        this.log('Token in instance:', this.token ? 'EXISTS' : 'NULL');
        
        // Check if user is already authenticated
        const isAuth = await this.isAuthenticated();
        this.log('Authentication result:', isAuth);
        
        if (isAuth) {
            this.log('User already authenticated', this.user);
            if (this.callbacks.onAuthSuccess) {
                this.log('Calling onAuthSuccess callback...');
                this.callbacks.onAuthSuccess(this.user, this.token, this.getPortalUrl());
            }
        } else {
            this.log('User not authenticated');
            // User is not authenticated - trigger logout callback if we had a token before
            // This handles the case where a user refreshes after logout or token expiry
            if (this.callbacks.onLogout) {
                this.log('Calling onLogout callback for unauthenticated user...');
                this.callbacks.onLogout();
            }
        }
        
        this.log('=== INITIALIZATION COMPLETED ===');
        return isAuth;
    }
}

// Auto-initialize if configuration is provided
if (typeof window !== 'undefined' && window.fiduConfig) {
    window.fidu = new FIDUAuth(window.fiduConfig);
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FIDUAuth;
}

// Export for ES6 modules
if (typeof window !== 'undefined') {
    window.FIDUAuth = FIDUAuth;
} 