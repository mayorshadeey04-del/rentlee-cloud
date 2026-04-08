// Get form and input elements
const form = document.getElementById('setPasswordForm');
const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirmPassword');
const submitBtn = form.querySelector('button[type="submit"]');

// Password requirement elements
const reqLength = document.getElementById('req-length');
const reqUppercase = document.getElementById('req-uppercase');
const reqLowercase = document.getElementById('req-lowercase');
const reqNumber = document.getElementById('req-number');

// Live Render API URL
const API_URL = 'https://rentlee-api.onrender.com/api';

// Get token from URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

// If no token, redirect to forgot password
if (!token) {
    alert('Invalid or missing reset token. Please request a new link.');
    window.location.href = 'forgot-password.html';
}

// Check password requirements in real-time
password.addEventListener('input', () => {
    const value = password.value;
    
    if (value.length >= 8) reqLength.classList.add('met'); else reqLength.classList.remove('met');
    if (/[A-Z]/.test(value)) reqUppercase.classList.add('met'); else reqUppercase.classList.remove('met');
    if (/[a-z]/.test(value)) reqLowercase.classList.add('met'); else reqLowercase.classList.remove('met');
    if (/[0-9]/.test(value)) reqNumber.classList.add('met'); else reqNumber.classList.remove('met');
    
    password.classList.remove('invalid');
    password.parentElement.querySelector('.error').textContent = '';
});

confirmPassword.addEventListener('input', () => {
    confirmPassword.classList.remove('invalid');
    confirmPassword.parentElement.querySelector('.error').textContent = '';
});

// Form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (validatePassword() && validateConfirmPassword()) {
        await handlePasswordSubmission();
    }
});

async function handlePasswordSubmission() {
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Processing...';
    submitBtn.disabled = true;

    try {
        /* NOTE: We check both endpoints. 
           If it's a reset (Forgot Password), we use /signin/reset-password
           If it's a new account setup, we use /signup/setup-password
        */
        
        // Let's try the Reset Password endpoint first
        let response = await fetch(`${API_URL}/signin/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token, newPassword: password.value })
        });

        // If that fails, try the Setup Password endpoint
        if (!response.ok) {
            response = await fetch(`${API_URL}/signup/setup-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, newPassword: password.value })
            });
        }

        const data = await response.json();

        if (response.ok) {
            submitBtn.textContent = 'Success! ✓';
            submitBtn.style.background = '#10b981';
            alert('Password updated successfully! Redirecting to login...');
            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        } else {
            throw new Error(data.message || 'Link expired or invalid.');
        }

    } catch (error) {
        console.error('Submission Error:', error);
        alert(error.message);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Validation Helpers
function validatePassword() {
    const value = password.value;
    if (value.length < 8 || !/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) {
        showError(password, 'Please meet all password requirements');
        return false;
    }
    showSuccess(password);
    return true;
}

function validateConfirmPassword() {
    if (confirmPassword.value !== password.value) {
        showError(confirmPassword, 'Passwords do not match');
        return false;
    }
    showSuccess(confirmPassword);
    return true;
}

function showError(input, message) {
    input.classList.add('invalid');
    const errorElement = input.parentElement.querySelector('.error');
    if (errorElement) errorElement.textContent = message;
}

function showSuccess(input) {
    input.classList.remove('invalid');
    input.classList.add('valid');
    const errorElement = input.parentElement.querySelector('.error');
    if (errorElement) errorElement.textContent = '';
}

function togglePassword(id, icon) {
    const field = document.getElementById(id);
    if (field.type === 'password') {
        field.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        field.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}