// ============================================
// FIXED OTP VERIFICATION - Proper Dashboard Redirect
// ============================================

// API Configuration
const API_URL = 'https://rentlee-api.onrender.com/api';

// Get elements
const form = document.getElementById('otpForm');
const otpInput = document.getElementById('otpCode');
const otpError = document.getElementById('otpError');
const verifyBtn = document.getElementById('verifyBtn');
const resendBtn = document.getElementById('resendBtn');
const timerSpan = document.getElementById('timer');
const userEmailSpan = document.getElementById('userEmail');

//  Get email from localStorage (set during signup)
const userEmail = localStorage.getItem('verificationEmail');

// Redirect if no email found
if (!userEmail) {
    showErrorPopup('No Email Found', 'Please sign up first to verify your email.');
    setTimeout(() => {
        window.location.href = 'signup.html';
    }, 2000);
} else {
    // Display email
    userEmailSpan.textContent = userEmail;
}

// Timer countdown
let timeLeft = 60;
let timerInterval;

function startTimer(spanElement = null) {
    timeLeft = 60;
    resendBtn.disabled = true;
    
    const targetSpan = spanElement || document.getElementById('timer');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        targetSpan.textContent = `(${timeLeft}s)`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            resendBtn.disabled = false;
            targetSpan.textContent = '';
        }
    }, 1000);
}

// Start timer on page load
startTimer();

// Handle OTP input
otpInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
    
    if (e.target.value.length === 6) {
        otpInput.classList.add('filled');
    } else {
        otpInput.classList.remove('filled');
    }
    
    otpInput.classList.remove('error');
    otpError.textContent = '';
});

// ============================================
//  FIXED: Form submission with proper redirect
// ============================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const otpValue = otpInput.value.trim();
    
    // Validate OTP
    if (otpValue.length < 6) {
        showError('Please enter the complete 6-digit code');
        otpInput.classList.add('error');
        return;
    }
    
    // Show loading state
    verifyBtn.textContent = 'Verifying...';
    verifyBtn.disabled = true;
    
    try {
        // STEP 1: Verify email
        const verifyResponse = await fetch(`${API_URL}/signup/verify-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: userEmail,
                code: otpValue
            })
        });

        const verifyData = await verifyResponse.json();

        if (verifyResponse.ok && verifyData.success) {
            //  Email verified successfully!
            verifyBtn.textContent = 'Verified! ';
            verifyBtn.style.background = '#10b981';
            
            // Clear verification email
            localStorage.removeItem('verificationEmail');
            
            //  STEP 2: Get the stored password (from signup)
            const signupPassword = localStorage.getItem('signupPassword');
            
            if (signupPassword) {
                //  STEP 3: Auto-login the user
                verifyBtn.textContent = 'Logging in...';
                
                const loginResponse = await fetch(`${API_URL}/signin/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: userEmail,
                        password: signupPassword
                    })
                });

                const loginData = await loginResponse.json();

            if (loginResponse.ok && loginData.success) {
    //  STEP 4: Build user object
    const { token, user } = loginData.data;

    const dashboardUser = {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        landlordId: user.landlordId || null,
        assignedPropertyIds: []
    };

    // Clear signup password
    localStorage.removeItem('signupPassword');

    verifyBtn.textContent = 'Success! Redirecting...';

    setTimeout(() => {
        //  Pass token + user via URL to React (fixes origin mismatch)
        const encodedUser  = encodeURIComponent(JSON.stringify(dashboardUser));
        const encodedToken = encodeURIComponent(token);
       window.location.href = `https://rentlee-cloud.vercel.app/auth-callback?token=${encodedToken}&user=${encodedUser}`;
    }, 1500);
                    
                } else {
                    // Login failed - show error
                    console.error('Auto-login failed:', loginData.message);
                    showErrorPopup('Login Failed', loginData.message || 'Unable to login automatically');
                    verifyBtn.textContent = 'Verify & Continue';
                    verifyBtn.disabled = false;
                }
            } else {
                // No password stored - this shouldn't happen
                console.error('No signup password found in localStorage');
                showErrorPopup('Error', 'Session expired. Please sign up again.');
                setTimeout(() => {
                    window.location.href = 'signup.html';
                }, 2000);
            }
            
        } else {
            // Verification failed
            const errorMessage = verifyData.message || 'Invalid verification code';
            showError(errorMessage);
            otpInput.classList.add('error');
            otpInput.classList.remove('filled');
            
            verifyBtn.textContent = 'Verify & Continue';
            verifyBtn.disabled = false;
            
            setTimeout(() => {
                otpInput.value = '';
                otpInput.classList.remove('error');
                otpInput.focus();
            }, 500);
        }

    } catch (error) {
        console.error('Verification error:', error);
        showErrorPopup('Connection Error', 'Unable to connect to server. Please try again.');
        
        verifyBtn.textContent = 'Verify & Continue';
        verifyBtn.disabled = false;
        verifyBtn.style.background = '';
    }
});

// ============================================
// Resend OTP
// ============================================
resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    resendBtn.innerHTML = 'Sending...';
    
    try {
        const response = await fetch(`${API_URL}/signup/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showInfoPopup('A new verification code has been sent to ' + userEmail);
            
            otpInput.value = '';
            otpInput.classList.remove('filled', 'error');
            otpInput.focus();
            otpError.textContent = '';
            
            resendBtn.innerHTML = 'Resend Code <span id="timer"></span>';
            clearInterval(timerInterval);
            startTimer(document.getElementById('timer'));
            
        } else {
            showErrorPopup('Resend Failed', data.message || 'Failed to resend code');
            resendBtn.disabled = false;
            resendBtn.innerHTML = 'Resend Code <span id="timer"></span>';
        }

    } catch (error) {
        console.error('Resend error:', error);
        showErrorPopup('Connection Error', 'Unable to connect to server.');
        resendBtn.disabled = false;
        resendBtn.innerHTML = 'Resend Code <span id="timer"></span>';
    }
});

// Helper function to show error
function showError(message) {
    otpError.textContent = message;
}

// Auto-focus input on load
window.addEventListener('load', () => {
    if (userEmail) {
        otpInput.focus();
    }
});

// ============================================
// POPUP NOTIFICATION FUNCTIONS
// ============================================

// Show error popup
function showErrorPopup(title, message) {
    const popup = document.getElementById('errorPopup');
    if (!popup) {
        console.error('Error popup element not found');
        alert(`${title}: ${message}`);
        return;
    }
    document.getElementById('errorTitle').textContent = title;
    document.getElementById('errorMessage').textContent = message;
    popup.classList.add('show');
}

// Close error popup
function closeErrorPopup() {
    const popup = document.getElementById('errorPopup');
    if (popup) {
        popup.classList.remove('show');
    }
}

// Show info popup
function showInfoPopup(message) {
    const popup = document.getElementById('infoPopup');
    if (!popup) {
        console.log(message);
        return;
    }
    document.getElementById('infoMessage').textContent = message;
    popup.classList.add('show');
}

// Close info popup
function closeInfoPopup() {
    const popup = document.getElementById('infoPopup');
    if (popup) {
        popup.classList.remove('show');
    }
}