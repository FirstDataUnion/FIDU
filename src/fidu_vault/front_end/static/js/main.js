// FIDU Vault Frontend JavaScript

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

// Initialize any page-specific functionality
document.addEventListener('DOMContentLoaded', function() {
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