// FIDU Vault Frontend JavaScript

// Theme management functionality
class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || 'auto';
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.setupEventListeners();
        this.updateThemeIcon();
    }

    getStoredTheme() {
        try {
            return localStorage.getItem('fidu-vault-theme');
        } catch (error) {
            console.warn('Failed to load theme from localStorage:', error);
            return 'auto';
        }
    }

    setStoredTheme(theme) {
        try {
            localStorage.setItem('fidu-vault-theme', theme);
        } catch (error) {
            console.warn('Failed to save theme to localStorage:', error);
        }
    }

    getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    getEffectiveTheme() {
        if (this.currentTheme === 'auto') {
            return this.getSystemTheme();
        }
        return this.currentTheme;
    }

    applyTheme(theme) {
        this.currentTheme = theme;
        this.setStoredTheme(theme);
        
        const effectiveTheme = this.getEffectiveTheme();
        const html = document.documentElement;
        
        if (effectiveTheme === 'dark') {
            html.classList.add('dark');
        } else {
            html.classList.remove('dark');
        }
        
        this.updateThemeIcon();
    }

    updateThemeIcon() {
        const lightIcon = document.getElementById('theme-icon-light');
        const darkIcon = document.getElementById('theme-icon-dark');
        const autoIcon = document.getElementById('theme-icon-auto');
        
        // Hide all icons
        [lightIcon, darkIcon, autoIcon].forEach(icon => {
            if (icon) icon.classList.add('hidden');
        });
        
        // Show the appropriate icon
        switch (this.currentTheme) {
            case 'light':
                if (lightIcon) lightIcon.classList.remove('hidden');
                break;
            case 'dark':
                if (darkIcon) darkIcon.classList.remove('hidden');
                break;
            case 'auto':
            default:
                if (autoIcon) autoIcon.classList.remove('hidden');
                break;
        }
    }

    setupEventListeners() {
        const toggleButton = document.getElementById('theme-toggle');
        console.log('Theme toggle button found:', toggleButton);
        if (toggleButton) {
            toggleButton.addEventListener('click', (event) => {
                console.log('Theme toggle clicked');
                event.preventDefault();
                this.cycleTheme();
            });
        } else {
            console.error('Theme toggle button not found!');
        }

        // Listen for system theme changes when in auto mode
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => {
            if (this.currentTheme === 'auto') {
                this.applyTheme('auto');
            }
        });
    }

    cycleTheme() {
        const themes = ['light', 'dark', 'auto'];
        const currentIndex = themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        console.log('Cycling theme from', this.currentTheme, 'to', themes[nextIndex]);
        this.applyTheme(themes[nextIndex]);
    }
}

// HTMX event handlers
document.addEventListener('htmx:beforeRequest', function(evt) {
    // Add loading state to buttons
    if (evt.detail.elt.tagName === 'BUTTON') {
        evt.detail.elt.classList.add('btn-loading');
    }
});

document.addEventListener('htmx:afterRequest', function(evt) {
    // Remove loading state from buttons
    if (evt.detail.elt.tagName === 'BUTTON') {
        evt.detail.elt.classList.remove('btn-loading');
    }
    
    // Handle form validation
    if (evt.detail.xhr.status === 400) {
        const response = JSON.parse(evt.detail.xhr.responseText);
        if (response.detail) {
            showError(response.detail);
        }
    }
});

document.addEventListener('htmx:responseError', function(evt) {
    // Handle response errors
    showError('An error occurred. Please try again.');
});

// Utility functions
function showError(message) {
    // Create error notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function showSuccess(message) {
    // Create success notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Form validation
function validateForm(form) {
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('form-error');
            isValid = false;
        } else {
            input.classList.remove('form-error');
        }
    });
    
    return isValid;
}

// Auto-hide notifications when clicking outside
document.addEventListener('click', function(evt) {
    if (evt.target.classList.contains('notification')) {
        evt.target.remove();
    }
});

// Version checking functionality
async function loadVersionInfo() {
    try {
        // Load current version
        const versionResponse = await fetch('/version/');
        const versionData = await versionResponse.json();
        
        // Update version display
        const versionElement = document.getElementById('app-version');
        if (versionElement) {
            versionElement.textContent = versionData.main_version;
        }
        
        // Check for updates (only on dashboard)
        if (document.getElementById('update-banner')) {
            await checkForUpdates();
        }
    } catch (error) {
        console.error('Error loading version info:', error);
        const versionElement = document.getElementById('app-version');
        if (versionElement) {
            versionElement.textContent = 'Error';
        }
    }
}

async function checkForUpdates() {
    try {
        const updateResponse = await fetch('/version/check-updates');
        const updateData = await updateResponse.json();
        
        if (updateData.status === 'update_available') {
            showUpdateBanner(updateData);
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
    }
}

function showUpdateBanner(updateData) {
    const banner = document.getElementById('update-banner');
    const latestVersionSpan = document.getElementById('latest-version');
    const downloadLink = document.getElementById('download-link');
    
    if (banner && latestVersionSpan && downloadLink) {
        latestVersionSpan.textContent = updateData.latest_version;
        downloadLink.href = updateData.download_url;
        banner.classList.remove('hidden');
    }
}

// Initialize any page-specific functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme manager
    console.log('Initializing theme manager...');
    window.themeManager = new ThemeManager();
    console.log('Theme manager initialized:', window.themeManager);
    
    // Load version info on all pages
    loadVersionInfo();
    
    // Add form validation to all forms
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(evt) {
            if (!validateForm(form)) {
                evt.preventDefault();
                showError('Please fill in all required fields.');
            }
        });
    });
    
    // Add smooth scrolling to anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(evt) {
            evt.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}); 