// Main JavaScript file for Travel Together application

// DOM Elements
const loginModal = document.getElementById('loginModal');
const signupModal = document.getElementById('signupModal');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');

// Modal Functions
function showLogin() {
    loginModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function showSignup() {
    signupModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = 'auto';
}

function switchToSignup() {
    closeModal('loginModal');
    showSignup();
}

function switchToLogin() {
    closeModal('signupModal');
    showLogin();
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target === loginModal) {
        closeModal('loginModal');
    }
    if (event.target === signupModal) {
        closeModal('signupModal');
    }
}

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal('loginModal');
        closeModal('signupModal');
    }
});

// Form Validation
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password.length >= 6;
}

function showError(input, message) {
    const formGroup = input.parentElement;
    let errorElement = formGroup.querySelector('.error-message');
    
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.style.color = '#e74c3c';
        errorElement.style.fontSize = '0.9rem';
        errorElement.style.marginTop = '0.5rem';
        formGroup.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    input.style.borderColor = '#e74c3c';
}

function clearError(input) {
    const formGroup = input.parentElement;
    const errorElement = formGroup.querySelector('.error-message');
    
    if (errorElement) {
        errorElement.remove();
    }
    
    input.style.borderColor = '#ddd';
}

// Login Form Handler
loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    // Clear previous errors
    clearError(document.getElementById('loginEmail'));
    clearError(document.getElementById('loginPassword'));
    
    let hasErrors = false;
    
    // Validate email
    if (!email) {
        showError(document.getElementById('loginEmail'), 'Email is required');
        hasErrors = true;
    } else if (!validateEmail(email)) {
        showError(document.getElementById('loginEmail'), 'Please enter a valid email');
        hasErrors = true;
    }
    
    // Validate password
    if (!password) {
        showError(document.getElementById('loginPassword'), 'Password is required');
        hasErrors = true;
    }
    
    if (hasErrors) return;
    
    // Show loading state
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('php/auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'login',
                email: email,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store user data
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            showError(document.getElementById('loginPassword'), data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError(document.getElementById('loginPassword'), 'Connection error. Please try again.');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Signup Form Handler
signupForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    
    // Clear previous errors
    clearError(document.getElementById('signupName'));
    clearError(document.getElementById('signupEmail'));
    clearError(document.getElementById('signupPassword'));
    clearError(document.getElementById('signupConfirmPassword'));
    
    let hasErrors = false;
    
    // Validate name
    if (!name) {
        showError(document.getElementById('signupName'), 'Name is required');
        hasErrors = true;
    } else if (name.length < 2) {
        showError(document.getElementById('signupName'), 'Name must be at least 2 characters');
        hasErrors = true;
    }
    
    // Validate email
    if (!email) {
        showError(document.getElementById('signupEmail'), 'Email is required');
        hasErrors = true;
    } else if (!validateEmail(email)) {
        showError(document.getElementById('signupEmail'), 'Please enter a valid email');
        hasErrors = true;
    }
    
    // Validate password
    if (!password) {
        showError(document.getElementById('signupPassword'), 'Password is required');
        hasErrors = true;
    } else if (!validatePassword(password)) {
        showError(document.getElementById('signupPassword'), 'Password must be at least 6 characters');
        hasErrors = true;
    }
    
    // Validate confirm password
    if (!confirmPassword) {
        showError(document.getElementById('signupConfirmPassword'), 'Please confirm your password');
        hasErrors = true;
    } else if (password !== confirmPassword) {
        showError(document.getElementById('signupConfirmPassword'), 'Passwords do not match');
        hasErrors = true;
    }
    
    if (hasErrors) return;
    
    // Show loading state
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating Account...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('php/auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'signup',
                name: name,
                email: email,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store user data
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirect to profile setup
            window.location.href = 'profile-setup.html';
        } else {
            showError(document.getElementById('signupEmail'), data.message || 'Signup failed');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showError(document.getElementById('signupEmail'), 'Connection error. Please try again.');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navigation active state
window.addEventListener('scroll', function() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        const sectionHeight = section.clientHeight;
        if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) {
            link.classList.add('active');
        }
    });
});

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', function() {
    const user = localStorage.getItem('user');
    if (user) {
        // User is logged in, update navigation
        const authButtons = document.querySelector('.auth-buttons');
        if (authButtons) {
            const userData = JSON.parse(user);
            authButtons.innerHTML = `
                <span>Welcome, ${userData.name}!</span>
                <button class="btn btn-primary" onclick="window.location.href='dashboard.html'">Dashboard</button>
                <button class="btn btn-outline" onclick="logout()">Logout</button>
            `;
        }
    }
});

// Logout function
function logout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Utility functions
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 3000;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add notification animations to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
