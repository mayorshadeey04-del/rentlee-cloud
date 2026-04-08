// Get form and input elements
const form = document.getElementById("resetForm");
const email = document.getElementById("email");
const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('button');

// Live Render API URL
const API_URL = 'https://rentlee-api.onrender.com/api';

// Form submission handler
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate email first
    if (!validateEmail()) return;

    const emailValue = email.value.trim();

    // UI Loading State
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = "Sending Link...";
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.7";

    try {
        const response = await fetch(`${API_URL}/signin/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: emailValue })
        });

        const data = await response.json();

        // Check if backend responded successfully
        if (response.ok && data.success) {
            alert("Password reset link sent! Please check your inbox and spam folder.");
            window.location.href = 'login.html'; // Redirect to login
        } else {
            // Handle backend errors (e.g., account not activated)
            showError(email, data.message || "Failed to send reset link.");
        }

    } catch (error) {
        console.error("Forgot password error:", error);
        showError(email, "Network error. Please try again later.");
    } finally {
        // Restore UI state
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
    }
});

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

// Real-time validation on input
email.addEventListener("input", validateEmail);