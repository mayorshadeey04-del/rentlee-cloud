// Get form and input elements
const form = document.getElementById("resetForm");
const email = document.getElementById("email");

// Form submission handler
form.addEventListener("submit", e => {
    e.preventDefault();

    // Validate email
    if (validateEmail()) {
        alert("Password reset link sent to your email! Please check your inbox and spam folder.");
        window.location.href='login.html'
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