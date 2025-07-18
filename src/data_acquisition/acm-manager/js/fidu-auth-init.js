// Initialize FIDU SDK
document.addEventListener('DOMContentLoaded', function () {
    // Ensure the container exists before initializing
    var container = document.getElementById('fiduAuthContainer');
    if (!container) return;

    // Helper to update auth status UI
    function updateAuthStatusUI(isAuthenticated, user) {
        var authStatusEl = document.getElementById('authStatus');
        var authStatusTextEl = document.getElementById('authStatusText');
        var toggleAuthBtnEl = document.getElementById('toggleAuthBtn');
        if (isAuthenticated) {
            if (authStatusEl) authStatusEl.className = 'auth-status authenticated';
            if (authStatusTextEl) authStatusTextEl.textContent = 'Authenticated';
            if (toggleAuthBtnEl) toggleAuthBtnEl.textContent = 'Logout';
        } else {
            if (authStatusEl) authStatusEl.className = 'auth-status not-authenticated';
            if (authStatusTextEl) authStatusTextEl.textContent = 'Not authenticated';
            if (toggleAuthBtnEl) toggleAuthBtnEl.textContent = 'Login';
        }
    }

    // Get FIDU Identity Service URL from settings
    getFiduIdentityServiceUrl(function(fiduHost) {
        const fidu = new FIDUAuth({
            fiduHost: fiduHost,
            debug: true
        });

        // Set up event handlers
        fidu.on('onAuthSuccess', async function(user, token, portalUrl) {
            // Store token and user using authService
            if (typeof authService !== 'undefined' && authService.storeAuthData) {
                try {
                    await authService.storeAuthData(token, user);
                } catch (e) {
                    console.error('Failed to store auth data:', e);
                }
            } else {
                // Fallback to localStorage if authService is not available
                localStorage.setItem('fidu_auth_token', token);
                localStorage.setItem('fidu_user_data', JSON.stringify(user));
            }
            // Hide the login widget
            var authContainer = document.getElementById('fiduAuthContainer');
            if (authContainer) authContainer.style.display = 'none';
            // Show user info
            var userInfoEl = document.getElementById('userInfo');
            if (userInfoEl) userInfoEl.style.display = 'block';
            // Update user info fields
            var userEmailEl = document.getElementById('userEmail');
            var userNameEl = document.getElementById('userName');
            if (userEmailEl) userEmailEl.textContent = user.email || '';
            if (userNameEl) userNameEl.textContent = (user.first_name || '') + ' ' + (user.last_name || '');
            // Show profile section
            var profileSectionEl = document.getElementById('profileSection');
            if (profileSectionEl) profileSectionEl.style.display = 'block';
            // Trigger popup re-initialisation to correctly show new details
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                  chrome.tabs.sendMessage(tabs[0].id, { action: 'authStatusChanged' });
                }
              });
            // Update auth status UI
            updateAuthStatusUI(true, user);
        });

        fidu.on('onAuthError', function(error) {
            console.error('Auth error:', error);
            updateAuthStatusUI(false);
        });

        // Check if user is already authenticated
        fidu.init().then(function(isAuthenticated) {
            if (!isAuthenticated) {
                // Show login widget
                var authContainer = document.getElementById('fiduAuthContainer');
                if (authContainer) authContainer.style.display = 'block';
                // Hide user info and profile section
                var userInfoEl = document.getElementById('userInfo');
                if (userInfoEl) userInfoEl.style.display = 'none';
                var profileSectionEl = document.getElementById('profileSection');
                if (profileSectionEl) profileSectionEl.style.display = 'none';
                updateAuthStatusUI(false);
                fidu.showLoginWidget();
            } else {
                // Hide the login widget
                var authContainer = document.getElementById('fiduAuthContainer');
                if (authContainer) authContainer.style.display = 'none';
                // Show user info and profile section
                var userInfoEl = document.getElementById('userInfo');
                if (userInfoEl) userInfoEl.style.display = 'block';
                var profileSectionEl = document.getElementById('profileSection');
                if (profileSectionEl) profileSectionEl.style.display = 'block';
                // Optionally, fetch and display user info if available
                // (You may want to store user info in localStorage on login)
                var user = null;
                try { user = JSON.parse(localStorage.getItem('fiduUser') || '{}'); } catch (e) {}
                updateAuthStatusUI(true, user);
            }
        });
    });

    var toggleAuthBtnEl = document.getElementById('toggleAuthBtn');
    var fiduInstance = null;

    function setupFidu() {
        getFiduIdentityServiceUrl(function(fiduHost) {
            const fidu = new FIDUAuth({
                fiduHost: fiduHost,
                debug: true
            });
            fiduInstance = fidu;

            fidu.on('onAuthSuccess', function(user, token, portalUrl) {
                console.log('User authenticated:', user);
                localStorage.setItem('fiduToken', token);
                // Hide the login widget
                var authContainer = document.getElementById('fiduAuthContainer');
                if (authContainer) authContainer.style.display = 'none';
                // Show user info
                var userInfoEl = document.getElementById('userInfo');
                if (userInfoEl) userInfoEl.style.display = 'block';
                // Update user info fields
                var userEmailEl = document.getElementById('userEmail');
                var userNameEl = document.getElementById('userName');
                if (userEmailEl) userEmailEl.textContent = user.email || '';
                if (userNameEl) userNameEl.textContent = (user.first_name || '') + ' ' + (user.last_name || '');
                // Show profile section
                var profileSectionEl = document.getElementById('profileSection');
                if (profileSectionEl) profileSectionEl.style.display = 'block';
                // Update auth status UI
                updateAuthStatusUI(true, user);
            });

            fidu.on('onAuthError', function(error) {
                console.error('Auth error:', error);
                updateAuthStatusUI(false);
            });

            fidu.init().then(function(isAuthenticated) {
                if (!isAuthenticated) {
                    // Show login widget
                    var authContainer = document.getElementById('fiduAuthContainer');
                    if (authContainer) authContainer.style.display = 'block';
                    // Hide user info and profile section
                    var userInfoEl = document.getElementById('userInfo');
                    if (userInfoEl) userInfoEl.style.display = 'none';
                    var profileSectionEl = document.getElementById('profileSection');
                    if (profileSectionEl) profileSectionEl.style.display = 'none';
                    updateAuthStatusUI(false);
                    fidu.showLoginWidget && fidu.showLoginWidget();
                } else {
                    // Hide the login widget
                    var authContainer = document.getElementById('fiduAuthContainer');
                    if (authContainer) authContainer.style.display = 'none';
                    // Show user info and profile section
                    var userInfoEl = document.getElementById('userInfo');
                    if (userInfoEl) userInfoEl.style.display = 'block';
                    var profileSectionEl = document.getElementById('profileSection');
                    if (profileSectionEl) profileSectionEl.style.display = 'block';
                    // Optionally, fetch and display user info if available
                    // (You may want to store user info in localStorage on login)
                    var user = null;
                    try { user = JSON.parse(localStorage.getItem('fiduUser') || '{}'); } catch (e) {}
                    updateAuthStatusUI(true, user);
                }
            });
        });
    }

    if (toggleAuthBtnEl) {
        toggleAuthBtnEl.addEventListener('click', function() {
            // If authenticated, log out
            var isAuthenticated = toggleAuthBtnEl.textContent === 'Logout';
            if (isAuthenticated && fiduInstance) {
                fiduInstance.logout && fiduInstance.logout();
                // After logout, update UI
                var authContainer = document.getElementById('fiduAuthContainer');
                if (authContainer) authContainer.style.display = 'block';
                var userInfoEl = document.getElementById('userInfo');
                if (userInfoEl) userInfoEl.style.display = 'none';
                var profileSectionEl = document.getElementById('profileSection');
                if (profileSectionEl) profileSectionEl.style.display = 'none';
                updateAuthStatusUI(false);
                fiduInstance.showLoginWidget && fiduInstance.showLoginWidget();
            } else if (fiduInstance) {
                // If not authenticated, show login widget
                var authContainer = document.getElementById('fiduAuthContainer');
                if (authContainer) authContainer.style.display = 'block';
                fiduInstance.showLoginWidget && fiduInstance.showLoginWidget();
            }
        });
    }

    setupFidu();
}); 