// ============================================
// API Configuration
// ============================================
const API_URL = 'http://localhost:5001/api';

// Get form and input elements
const form = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");

// Add loading state
let isSubmitting = false;

// ============================================
// Form submission handler - CONNECTED TO BACKEND
// ============================================
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Prevent double submission
    if (isSubmitting) return;

    // Validate fields
    const emailOK = validateEmail();
    const passOK = validatePassword();

    // If all validations pass, login via backend
    if (emailOK && passOK) {
        await loginUser();
    }
});

// ============================================
// Login User via Backend API
// ============================================
async function loginUser() {
    try {
        isSubmitting = true;
        
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Logging in...';
        submitBtn.disabled = true;

        // Prepare credentials
        const credentials = {
            email: email.value.trim(),
            password: password.value
        };

        console.log('🔐 Attempting login for:', credentials.email);

        // ✅ Call backend login endpoint
        const response = await fetch(`${API_URL}/signin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        });

        const data = await response.json();
        console.log('📥 Login response:', data);

        if (response.ok && data.success) {
            // ✅ LOGIN SUCCESSFUL
            const { token, user } = data.data;

            console.log('✅ Login successful for user:', user);

            // Store authentication token
            localStorage.setItem('authToken', token);

           // Build dashboard user object
const dashboardUser = {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: user.role,
    landlordId: user.landlordId || null,
    assignedPropertyIds: []
};

console.log('💾 User data ready:', dashboardUser);

// ✅ Show success message
submitBtn.textContent = 'Success! Redirecting...';
submitBtn.style.background = '#10b981';

// ✅ Pass token + user via URL to React (fixes origin mismatch)
setTimeout(() => {
    console.log('🚀 Redirecting to dashboard...');
    const encodedUser  = encodeURIComponent(JSON.stringify(dashboardUser));
    const encodedToken = encodeURIComponent(token);
    window.location.href = `http://localhost:5173/auth-callback?token=${encodedToken}&user=${encodedUser}`;
}, 1000);

        } else {
            // ❌ LOGIN FAILED
            const errorMessage = data.message || 'Invalid email or password';
            console.error('❌ Login failed:', errorMessage);
            
            showErrorPopup('Login Failed', errorMessage);

            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            submitBtn.style.background = '';
            isSubmitting = false;
        }

    } catch (error) {
        console.error('❌ Login error:', error);
        
        showErrorPopup('Connection Error', 'Unable to connect to the server. Please make sure the backend is running.');

        // Reset button
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Log In';
        submitBtn.disabled = false;
        submitBtn.style.background = '';
        isSubmitting = false;
    }
}

// ============================================
// Validation Functions
// ============================================

// Helper function to show error
function showError(input, message) {
    input.classList.add("invalid");
    input.classList.remove("valid");
    const errorElement = input.parentElement.querySelector(".error");
    if (errorElement) {
        errorElement.innerText = message;
    }
}

// Helper function to show success
function showSuccess(input) {
    input.classList.remove("invalid");
    input.classList.add("valid");
    const errorElement = input.parentElement.querySelector(".error");
    if (errorElement) {
        errorElement.innerText = "";
    }
}

// Validate Email
function validateEmail() {
    const value = email.value.trim();
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (value === "") {
        showError(email, "Email is required");
        return false;
    }
    if (!pattern.test(value)) {
        showError(email, "Enter a valid email address");
        return false;
    }
    showSuccess(email);
    return true;
}

// Validate Password
function validatePassword() {
    const value = password.value;
    
    if (value === "") {
        showError(password, "Password is required");
        return false;
    }
    if (value.length < 8) {
        showError(password, "Password must be at least 8 characters");
        return false;
    }
    showSuccess(password);
    return true;
}

// Real-time validation on input
email.addEventListener("input", validateEmail);
password.addEventListener("input", validatePassword);

// ============================================
// Toggle password visibility
// ============================================
function togglePassword() {
    const icon = document.querySelector(".toggle");
    
    if (password.type === "password") {
        password.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        password.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
}

// ============================================
// Popup/Modal Functions
// ============================================

// Show error popup
function showErrorPopup(title, message) {
    // Create error popup if it doesn't exist
    let errorPopup = document.getElementById('errorPopup');
    
    if (!errorPopup) {
        errorPopup = document.createElement('div');
        errorPopup.id = 'errorPopup';
        errorPopup.className = 'popup-overlay';
        errorPopup.innerHTML = `
            <div class="popup-content">
                <div class="popup-icon error-icon">
                    <i class="fa-solid fa-xmark"></i>
                </div>
                <h3 id="errorTitle">${title}</h3>
                <p id="errorMessage">${message}</p>
                <button class="popup-btn" onclick="closeErrorPopup()">Try Again</button>
            </div>
        `;
        document.body.appendChild(errorPopup);
        
        // Add styles if not already present
        if (!document.getElementById('popupStyles')) {
            const style = document.createElement('style');
            style.id = 'popupStyles';
            style.textContent = `
                .popup-overlay {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                }
                .popup-overlay.show {
                    display: flex;
                }
                .popup-content {
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    text-align: center;
                    max-width: 400px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                }
                .popup-icon {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    margin: 0 auto 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                }
                .error-icon {
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                }
                .popup-content h3 {
                    margin: 0 0 10px 0;
                    color: #333;
                }
                .popup-content p {
                    margin: 0 0 20px 0;
                    color: #666;
                }
                .popup-btn {
                    padding: 12px 30px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                }
                .popup-btn:hover {
                    background: #2563eb;
                }
            `;
            document.head.appendChild(style);
        }
    } else {
        document.getElementById('errorTitle').textContent = title;
        document.getElementById('errorMessage').textContent = message;
    }
    
    errorPopup.classList.add('show');
}

// Close error popup
function closeErrorPopup() {
    const errorPopup = document.getElementById('errorPopup');
    if (errorPopup) {
        errorPopup.classList.remove('show');
    }
}


// ============================================
// Auto-focus email on page load
// ============================================
window.addEventListener('load', () => {
    email.focus();
});