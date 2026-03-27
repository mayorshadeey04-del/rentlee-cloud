// Get form and input elements
const form = document.getElementById('setPasswordForm');
const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirmPassword');

// Password requirement elements
const reqLength = document.getElementById('req-length');
const reqUppercase = document.getElementById('req-uppercase');
const reqLowercase = document.getElementById('req-lowercase');
const reqNumber = document.getElementById('req-number');

// Get token from URL (sent in password reset email)
const urlParams = new URLSearchParams(window.location.search);
const resetToken = urlParams.get('token');

// If no token, redirect to forgot password (or login)
if (!resetToken) {
    alert('Invalid or missing reset token. Please request a new password link.');
    window.location.href = 'forgot-password.html';
}

// Check password requirements in real-time
password.addEventListener('input', () => {
    const value = password.value;
    
    // Check length (8+ characters)
    if (value.length >= 8) {
        reqLength.classList.add('met');
    } else {
        reqLength.classList.remove('met');
    }
    
    // Check uppercase
    if (/[A-Z]/.test(value)) {
        reqUppercase.classList.add('met');
    } else {
        reqUppercase.classList.remove('met');
    }
    
    // Check lowercase
    if (/[a-z]/.test(value)) {
        reqLowercase.classList.add('met');
    } else {
        reqLowercase.classList.remove('met');
    }
    
    // Check number
    if (/[0-9]/.test(value)) {
        reqNumber.classList.add('met');
    } else {
        reqNumber.classList.remove('met');
    }
    
    // Clear error
    password.classList.remove('invalid');
    password.parentElement.querySelector('.error').textContent = '';
});

// Validate confirm password in real-time
confirmPassword.addEventListener('input', () => {
    confirmPassword.classList.remove('invalid');
    confirmPassword.parentElement.querySelector('.error').textContent = '';
});

// Form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate password
    const passwordOK = validatePassword();
    const confirmOK = validateConfirmPassword();
    
    if (passwordOK && confirmOK) {
        await resetPassword();
    }
});

// Validate password meets all requirements
function validatePassword() {
    const value = password.value;
    
    if (value === '') {
        showError(password, 'Password is required');
        return false;
    }
    
    if (value.length < 8) {
        showError(password, 'Password must be at least 8 characters');
        return false;
    }
    
    if (!/[A-Z]/.test(value)) {
        showError(password, 'Password must contain an uppercase letter');
        return false;
    }
    
    if (!/[a-z]/.test(value)) {
        showError(password, 'Password must contain a lowercase letter');
        return false;
    }
    
    if (!/[0-9]/.test(value)) {
        showError(password, 'Password must contain a number');
        return false;
    }
    
    showSuccess(password);
    return true;
}

// Validate confirm password matches
function validateConfirmPassword() {
    const value = confirmPassword.value;
    
    if (value === '') {
        showError(confirmPassword, 'Please confirm your password');
        return false;
    }
    
    if (value !== password.value) {
        showError(confirmPassword, 'Passwords do not match');
        return false;
    }
    
    showSuccess(confirmPassword);
    return true;
}

// Reset/Set password via API
async function resetPassword() {
    try {
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Setting Password...';
        submitBtn.disabled = true;
        
        // Make the actual call to your backend
        const response = await fetch('http://localhost:5001/api/signup/setup-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: resetToken,
                newPassword: password.value
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to set password');
        }
        
        // Success State
        submitBtn.textContent = 'Password Set! ✓';
        submitBtn.style.background = '#10b981';
        
        alert('Password set successfully! You can now log in to your account.');
        
        // Redirect to login page
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        
    } catch (error) {
        console.error('Password Setup Error:', error);
        alert(error.message || 'Failed to set password. Please try again or request a new link.');
        
        // Reset button state
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Set Password';
        submitBtn.disabled = false;
    }
}

// Helper functions
function showError(input, message) {
    input.classList.add('invalid');
    input.classList.remove('valid');
    const errorElement = input.parentElement.querySelector('.error');
    if (errorElement) {
        errorElement.textContent = message;
    }
}

function showSuccess(input) {
    input.classList.remove('invalid');
    input.classList.add('valid');
    const errorElement = input.parentElement.querySelector('.error');
    if (errorElement) {
        errorElement.textContent = '';
    }
}

// Toggle password visibility
function togglePassword(id, icon) {
    const field = document.getElementById(id);
    
    if (field.type === 'password') {
        field.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        field.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}