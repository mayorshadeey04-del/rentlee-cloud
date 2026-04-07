const API_URL = 'import.meta.env.VITE_API_URL'; // ✅ Changed to port 5001 to match your backend

// Get form and input elements
const form = document.getElementById("signupForm");
const firstName = document.getElementById("firstName");
const lastName = document.getElementById("lastName");
const email = document.getElementById("email");
const phone = document.getElementById("phone");
const password = document.getElementById("password");
const confirm = document.getElementById("confirm");

// Add loading state
let isSubmitting = false;

// Form submission handler
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Prevent double submission
    if (isSubmitting) return;

    // Validate all fields
    const firstNameOK = validateFirstName();
    const lastNameOK = validateLastName();
    const emailOK = validateEmail();
    const phoneOK = validatePhone();
    const passOK = validatePassword();
    const confirmOK = validateConfirm();

    // If all validations pass, submit to backend
    if (firstNameOK && lastNameOK && emailOK && phoneOK && passOK && confirmOK) {
        await registerUser();
    }
});

// ============================================
// Register user via API - UPDATED FOR YOUR BACKEND
// ============================================
async function registerUser() {
    try {
        isSubmitting = true;
        
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating Account...';
        submitBtn.disabled = true;

        // Prepare data - MATCHES YOUR BACKEND SCHEMA
        const userData = {
            firstName: firstName.value.trim(),
            lastName: lastName.value.trim(),
            email: email.value.trim(),
            phone: phone.value.trim(),
            password: password.value
        };

        // ✅ UPDATED: Call your actual backend endpoint
        const response = await fetch(`${API_URL}/signup/landlord`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        // ✅ UPDATED: Handle your backend response format
        if (response.ok && data.success) {
            // Store email for OTP verification
            localStorage.setItem('verificationEmail', email.value.trim());
            
            // ✅ NEW: Store password temporarily for auto-login after OTP
            localStorage.setItem('signupPassword', password.value);
            
            // ✅ UPDATED: Store user data if needed
            if (data.user) {
                localStorage.setItem('tempUser', JSON.stringify(data.user));
            }

            // ✅ Show beautiful success popup instead of alert
            showSuccessPopup(email.value.trim());

        } else {
            // ✅ UPDATED: Handle your backend error format
            const errorMessage = data.message || 'Registration failed. Please try again.';
            showErrorPopup('Registration Failed', errorMessage);

            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            isSubmitting = false;
        }

    } catch (error) {
        console.error('Registration Error:', error);
        
        // ✅ Show error popup instead of alert
        showErrorPopup('Connection Error', 'Unable to connect to the server. Please make sure the backend server is running on port 5001.');

        // Reset button
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Sign Up';
        submitBtn.disabled = false;
        isSubmitting = false;
    }
}

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

// Validate First Name
function validateFirstName() {
    const value = firstName.value.trim();
    if (value === "") {
        showError(firstName, "First name is required");
        return false;
    }
    if (value.length < 2) {
        showError(firstName, "First name must be at least 2 characters");
        return false;
    }
    if (!/^[a-zA-Z\s]+$/.test(value)) {
        showError(firstName, "First name can only contain letters");
        return false;
    }
    showSuccess(firstName);
    return true;
}

// Validate Last Name
function validateLastName() {
    const value = lastName.value.trim();
    if (value === "") {
        showError(lastName, "Last name is required");
        return false;
    }
    if (value.length < 2) {
        showError(lastName, "Last name must be at least 2 characters");
        return false;
    }
    if (!/^[a-zA-Z\s]+$/.test(value)) {
        showError(lastName, "Last name can only contain letters");
        return false;
    }
    showSuccess(lastName);
    return true;
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

// Validate Phone (Kenya format: 10 digits starting with 0)
function validatePhone() {
    const value = phone.value.trim();
    const pattern = /^0\d{9}$/;
    if (value === "") {
        showError(phone, "Phone number is required");
        return false;
    }
    if (!pattern.test(value)) {
        showError(phone, "Enter a valid 10-digit phone number (e.g., 0712345678)");
        return false;
    }
    showSuccess(phone);
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

// Validate Confirm Password
function validateConfirm() {
    const value = confirm.value;
    if (value === "") {
        showError(confirm, "Please confirm your password");
        return false;
    }
    if (value !== password.value) {
        showError(confirm, "Passwords do not match");
        return false;
    }
    showSuccess(confirm);
    return true;
}

// Real-time validation on input
firstName.addEventListener("input", validateFirstName);
lastName.addEventListener("input", validateLastName);
email.addEventListener("input", validateEmail);
phone.addEventListener("input", validatePhone);
password.addEventListener("input", validatePassword);
confirm.addEventListener("input", validateConfirm);

// Toggle password visibility (both fields together)
function togglePassword(id, icon) {
    const passwordField = document.getElementById('password');
    const confirmField = document.getElementById('confirm');
    const allIcons = document.querySelectorAll('.toggle');
    
    // Toggle both fields together
    if (passwordField.type === "password") {
        passwordField.type = "text";
        confirmField.type = "text";
        
        // Update all eye icons
        allIcons.forEach(i => {
            i.classList.remove("fa-eye");
            i.classList.add("fa-eye-slash");
        });
    } else {
        passwordField.type = "password";
        confirmField.type = "password";
        
        // Update all eye icons
        allIcons.forEach(i => {
            i.classList.remove("fa-eye-slash");
            i.classList.add("fa-eye");
        });
    }
}

// ============================================
// POPUP NOTIFICATION FUNCTIONS
// ============================================

// Show beautiful success popup
function showSuccessPopup(userEmail) {
    const popup = document.getElementById('successPopup');
    const emailElement = document.getElementById('popupEmail');
    
    // Set the email in popup
    emailElement.textContent = userEmail;
    
    // Show popup with animation
    popup.classList.add('show');
}

// Close success popup and redirect
function closeSuccessPopup() {
    const userEmail = localStorage.getItem('verificationEmail');
    window.location.href = 'otp-verification.html';
}

// Show error popup (for registration/network errors)
function showErrorPopup(title, message) {
    // Create error popup if it doesn't exist
    let errorPopup = document.getElementById('errorPopup');
    
    if (!errorPopup) {
        errorPopup = document.createElement('div');
        errorPopup.id = 'errorPopup';
        errorPopup.className = 'success-popup';
        errorPopup.innerHTML = `
            <div class="success-popup-content">
                <div class="success-icon" style="background: linear-gradient(135deg, #ef4444, #dc2626);">
                    <i class="fa-solid fa-xmark"></i>
                </div>
                <h3 id="errorTitle">${title}</h3>
                <p id="errorMessage">${message}</p>
                <button class="success-popup-btn" onclick="closeErrorPopup()">Try Again</button>
            </div>
        `;
        document.body.appendChild(errorPopup);
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