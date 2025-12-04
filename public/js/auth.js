document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    const urlParams = new URLSearchParams(window.location.search);
    const sessionExpired = urlParams.get('expired') === '1';
    
    if (sessionExpired) {
        clearSessionCookies();
        if (loginForm) {
            showAlert('Your session has expired. Please log in again.', 'warning');
        }
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (registerForm) {
        populateDegreeSelect();
        registerForm.addEventListener('submit', handleRegister);
    }

    if (isLoggedIn() && !sessionExpired) {
        window.location.href = '/dashboard.html';
    }
});

async function populateDegreeSelect() {
    try {
        const { data } = await apiCall('/degrees');
        const select = document.getElementById('major');
        if (!select) return;

        if (data.degrees) {
            select.innerHTML = '<option value="">Select degree...</option>';
            data.degrees.forEach(degree => {
                const option = document.createElement('option');
                option.value = degree.name;
                option.textContent = degree.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading degrees:', error);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showAlert('Please enter both email and password', 'danger');
        return;
    }

    showAlert('Logging in...', 'info');
    
    if (typeof sessionInvalidated !== 'undefined') {
        sessionInvalidated = false;
    }

    const { data, response } = await apiCall('/auth/login', {
        method: 'POST',
        body: { email, password }
    });

    if (data.success) {
        showAlert('Login successful! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1000);
    } else {
        if (data.banned || response?.status === 403) {
            const reason = encodeURIComponent(data.banReason || 'Your account has been banned from using SkillSwap. Please contact the administrator if you believe this is an error.');
            showAlert('Your account has been banned', 'danger');
            setTimeout(() => {
                window.location.href = `/banned.html?reason=${reason}`;
            }, 2000);
        } else {
            const errorMessage = data.error || 'Invalid email or password. Please check your credentials and try again.';
            showAlert(errorMessage, 'danger');
        }
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const formData = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        confirmPassword: document.getElementById('confirmPassword').value,
        blockName: document.getElementById('blockName').value,
        isTutor: document.getElementById('isTutor').checked,
        major: document.getElementById('major').value || null,
        yearOfStudy: document.getElementById('yearOfStudy').value || null,
        bio: document.getElementById('bio').value || null
    };

    showAlert('', 'info');

    const { data } = await apiCall('/auth/register', {
        method: 'POST',
        body: formData
    });

    if (data.success) {

        showAlert('Registration successful! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1000);
    } else {
        showAlert(data.error || 'Registration failed', 'danger');
    }
}

function showAlert(message, type) {
    const container = document.getElementById('alertContainer');
    if (!container) return;

    if (!message) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}
