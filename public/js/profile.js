const NOTIFICATION_PREFS_KEY = 'skillswap_notification_prefs';

document.addEventListener('DOMContentLoaded', async () => {

    const auth = await requireAuth();
    if (!auth) return;

    await Promise.all([
        loadProfile(),
        populateDegreeSelect(),
        loadAllSkills()
    ]);

    setupProfileForm();
    setupPictureUpload();
    loadNotificationPrefs();
});

function getNotificationPrefs() {
    try {
        const prefs = localStorage.getItem(NOTIFICATION_PREFS_KEY);
        return prefs ? JSON.parse(prefs) : {
            sessionRequests: true,
            sessionStatus: true,
            messages: true,
            reviews: true,
            announcements: true
        };
    } catch {
        return {
            sessionRequests: true,
            sessionStatus: true,
            messages: true,
            reviews: true,
            announcements: true
        };
    }
}

function loadNotificationPrefs() {
    const prefs = getNotificationPrefs();
    
    const sessionRequestsEl = document.getElementById('notifSessionRequests');
    const sessionStatusEl = document.getElementById('notifSessionStatus');
    const messagesEl = document.getElementById('notifMessages');
    const reviewsEl = document.getElementById('notifReviews');
    const announcementsEl = document.getElementById('notifAnnouncements');
    
    if (sessionRequestsEl) sessionRequestsEl.checked = prefs.sessionRequests;
    if (sessionStatusEl) sessionStatusEl.checked = prefs.sessionStatus;
    if (messagesEl) messagesEl.checked = prefs.messages;
    if (reviewsEl) reviewsEl.checked = prefs.reviews;
    if (announcementsEl) announcementsEl.checked = prefs.announcements;
}

function saveNotificationPrefs() {
    const prefs = {
        sessionRequests: document.getElementById('notifSessionRequests')?.checked ?? true,
        sessionStatus: document.getElementById('notifSessionStatus')?.checked ?? true,
        messages: document.getElementById('notifMessages')?.checked ?? true,
        reviews: document.getElementById('notifReviews')?.checked ?? true,
        announcements: document.getElementById('notifAnnouncements')?.checked ?? true
    };
    
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
    
    const statusEl = document.getElementById('notifSaveStatus');
    if (statusEl) {
        statusEl.innerHTML = '<span style="color: var(--green-primary);">✓ Preferences saved</span>';
        statusEl.style.display = 'block';
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 2000);
    }
}

let allSkills = [];
let mySkills = [];

async function populateDegreeSelect() {
    try {

        const cachedDegrees = localStorage.getItem('degrees');
        const cachedTime = localStorage.getItem('degrees_timestamp');
        const CACHE_DURATION = 3600000;

        let degrees = [];

        if (cachedDegrees && cachedTime && (Date.now() - parseInt(cachedTime) < CACHE_DURATION)) {
            degrees = JSON.parse(cachedDegrees);
        } else {
            const { data } = await apiCall('/degrees');
            if (data.degrees) {
                degrees = data.degrees;
                localStorage.setItem('degrees', JSON.stringify(degrees));
                localStorage.setItem('degrees_timestamp', Date.now().toString());
            }
        }

        const select = document.getElementById('major');
        if (!select) return;

        select.innerHTML = '<option value="">Select degree...</option>';
        degrees.forEach(degree => {
            const option = document.createElement('option');
            option.value = degree.name;
            option.textContent = degree.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading degrees:', error);
    }
}

async function loadAllSkills() {
    try {

        const cachedSkills = localStorage.getItem('skills');
        const cachedTime = localStorage.getItem('skills_timestamp');
        const CACHE_DURATION = 3600000;

        if (cachedSkills && cachedTime && (Date.now() - parseInt(cachedTime) < CACHE_DURATION)) {
            allSkills = JSON.parse(cachedSkills);
            populateSkillSelect();
        } else {
            const { data } = await apiCall('/skills');
            if (data.skills) {
                allSkills = data.skills;
                localStorage.setItem('skills', JSON.stringify(allSkills));
                localStorage.setItem('skills_timestamp', Date.now().toString());
                populateSkillSelect();
            }
        }
    } catch (error) {
        console.error('Error loading skills:', error);
    }
}

function populateSkillSelect() {
    const select = document.getElementById('skillSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Select a skill to add...</option>';

    const categories = {};
    allSkills.forEach(skill => {
        if (!categories[skill.category]) categories[skill.category] = [];
        categories[skill.category].push(skill);
    });

    Object.keys(categories).sort().forEach(category => {
        const group = document.createElement('optgroup');
        group.label = category;
        categories[category].sort((a, b) => a.name.localeCompare(b.name)).forEach(skill => {
            const option = document.createElement('option');
            option.value = skill.id;
            option.textContent = skill.name;
            group.appendChild(option);
        });
        select.appendChild(group);
    });
}

async function loadMySkills() {
    try {
        const { data } = await apiCall('/profile/skills');
        if (data.skills) {
            mySkills = data.skills;
            renderMySkills();
        }
    } catch (error) {
        console.error('Error loading my skills:', error);
    }
}

function renderMySkills() {
    const container = document.getElementById('mySkillsList');
    if (!container) return;

    container.innerHTML = '';

    if (mySkills.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-500); font-style: italic;">No skills added yet.</p>';
        return;
    }

    mySkills.forEach(skill => {
        const badge = document.createElement('div');
        badge.className = 'badge badge-primary';
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '0.5rem';
        badge.innerHTML = `
            ${skill.name}
            <span style="cursor: pointer; opacity: 0.8;" onclick="removeSkill(${skill.id})" title="Remove skill">×</span>
        `;
        container.appendChild(badge);
    });
}

async function addSkill() {
    const select = document.getElementById('skillSelect');
    const skillId = select.value;

    if (!skillId) return;

    if (mySkills.find(s => s.id === parseInt(skillId))) {
        showAlert('You already have this skill', 'warning');
        return;
    }

    showAlert('Adding skill...', 'info');

    try {
        const { data } = await apiCall('/profile/skills', {
            method: 'POST',
            body: { skillId }
        });

        if (data.success) {
            showAlert('Skill added successfully', 'success');
            await loadMySkills();
            select.value = '';
        } else {
            showAlert(data.error || 'Failed to add skill', 'danger');
        }
    } catch (error) {
        console.error('Error adding skill:', error);
        showAlert('Failed to add skill', 'danger');
    }
}

async function removeSkill(skillId) {
    if (!confirm('Are you sure you want to remove this skill?')) return;

    showAlert('Removing skill...', 'info');

    try {
        const { data } = await apiCall('/profile/skills', {
            method: 'DELETE',
            body: { skillId }
        });

        if (data.success) {
            showAlert('Skill removed successfully', 'success');
            await loadMySkills();
        } else {
            showAlert(data.error || 'Failed to remove skill', 'danger');
        }
    } catch (error) {
        console.error('Error removing skill:', error);
        showAlert('Failed to remove skill', 'danger');
    }
}

async function loadProfile() {
    try {
        const { data } = await apiCall('/profile');

        if (data.error) {
            showAlert('Failed to load profile: ' + data.error, 'danger');
            return;
        }

        const profile = data.profile;
        if (!profile) {
            showAlert('Profile not found', 'danger');
            return;
        }

        document.getElementById('userEmail').textContent = profile.email || '-';
        document.getElementById('userBlock').textContent = `Block: ${profile.blockName || '-'}`;
        document.getElementById('displayEmail').textContent = profile.email || '-';
        document.getElementById('displayBlock').textContent = profile.blockName || '-';
        document.getElementById('displayPoints').textContent = profile.pointsBalance || 0;
        document.getElementById('displayAccountType').textContent = profile.isTutor ? 'Tutor' : 'Student';

        const tutorSkillsSection = document.getElementById('tutorSkillsSection');
        if (tutorSkillsSection) {
            if (profile.isTutor) {
                tutorSkillsSection.style.display = 'block';
                loadMySkills();
            } else {
                tutorSkillsSection.style.display = 'none';
            }
        }

        const blockSelect = document.getElementById('blockName');
        if (blockSelect) {
            blockSelect.value = profile.blockName || '';
        }

        const firstNameInput = document.getElementById('firstName');
        const lastNameInput = document.getElementById('lastName');
        const nameHelp = document.getElementById('nameHelp');

        if (firstNameInput && lastNameInput) {
            firstNameInput.value = profile.firstName || '';
            lastNameInput.value = profile.lastName || '';

            if (profile.nameChangeCount && profile.nameChangeCount >= 1) {
                firstNameInput.disabled = true;
                lastNameInput.disabled = true;
                firstNameInput.title = "Name has already been changed once.";
                lastNameInput.title = "Name has already been changed once.";
                if (nameHelp) {
                    nameHelp.textContent = "Name has already been changed once and cannot be changed again.";
                    nameHelp.style.display = 'block';
                    nameHelp.style.color = 'var(--danger)';
                }
            } else {
                firstNameInput.disabled = false;
                lastNameInput.disabled = false;
                if (nameHelp) {
                    nameHelp.style.display = 'block';
                }
            }
        }

        if (profile.profile) {
            document.getElementById('bio').value = profile.profile.bio || '';
            document.getElementById('major').value = profile.profile.major || '';
            document.getElementById('yearOfStudy').value = profile.profile.yearOfStudy || '';
        }

        const img = document.getElementById('profilePicture');
        const placeholder = document.getElementById('profilePicturePlaceholder');

        if (profile.profile && profile.profile.profilePicture) {

            const pictureUrl = profile.profile.profilePicture + (profile.profile.profilePicture.includes('?') ? '&' : '?') + 't=' + Date.now();

            img.classList.add('hidden');
            placeholder.classList.remove('hidden');

            const testImg = new Image();
            testImg.onload = () => {
                img.src = pictureUrl;
                img.classList.remove('hidden');
                placeholder.classList.add('hidden');
            };
            testImg.onerror = () => {

                console.error('Failed to load profile picture:', pictureUrl);
                img.classList.add('hidden');
                placeholder.classList.remove('hidden');
            };
            testImg.src = pictureUrl;
        } else {
            img.classList.add('hidden');
            placeholder.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showAlert('Failed to load profile', 'danger');
    }
}

function setupProfileForm() {
    const form = document.getElementById('profileForm');
    if (form) {
        form.addEventListener('submit', handleProfileUpdate);
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();

    const bio = document.getElementById('bio').value;
    const major = document.getElementById('major').value;
    const yearOfStudy = document.getElementById('yearOfStudy').value;
    const blockName = document.getElementById('blockName').value;
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;

    if (!blockName || blockName.trim().length === 0) {
        showAlert('Block name is required', 'danger');
        return;
    }

    if ((firstName && !lastName) || (!firstName && lastName)) {
        showAlert('Both First Name and Last Name are required if you want to change your name.', 'warning');
        return;
    }

    showAlert('Saving profile...', 'info');

    try {
        const { data } = await apiCall('/profile', {
            method: 'PUT',
            body: {
                bio,
                major,
                yearOfStudy: yearOfStudy ? parseInt(yearOfStudy) : null,
                blockName: blockName.trim(),
                firstName: firstName ? firstName.trim() : null,
                lastName: lastName ? lastName.trim() : null
            }
        });

        if (data.success) {
            showAlert('Profile updated successfully!', 'success');

            setTimeout(() => {
                loadProfile();
            }, 1000);
        } else {
            showAlert(data.error || 'Failed to update profile', 'danger');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showAlert('Failed to update profile', 'danger');
    }
}

function setupPictureUpload() {
    const input = document.getElementById('profilePictureInput');
    if (input) {
        input.addEventListener('change', handlePictureUpload);
    }
}

async function handlePictureUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showAlert('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.', 'danger');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showAlert('File too large. Maximum size is 5MB.', 'danger');
        return;
    }

    showAlert('Uploading picture...', 'info');

    try {

        const formData = new FormData();
        formData.append('profilePicture', file);

        const response = await fetch('/api/upload/profile-picture', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        const uploadData = await response.json();

        if (!uploadData.success) {
            showAlert(uploadData.error || 'Failed to upload picture', 'danger');
            return;
        }

        const { data } = await apiCall('/profile/picture', {
            method: 'PUT',
            body: { profilePicture: uploadData.url }
        });

        if (data.success) {
            showAlert('Profile picture updated successfully!', 'success');

            setTimeout(() => {
                loadProfile();
            }, 500);
        } else {
            showAlert(data.error || 'Failed to update profile picture', 'danger');
        }
    } catch (error) {
        console.error('Error uploading picture:', error);
        showAlert('Failed to upload picture', 'danger');
    }

    e.target.value = '';
}

function showAlert(message, type) {
    const container = document.getElementById('alertContainer');
    if (!message) {
        container.innerHTML = '';
        return;
    }

    if (type === 'success') {

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.type = 'sine';
            oscillator.frequency.value = 500;
            gainNode.gain.value = 0.1;
            oscillator.start();
            setTimeout(() => oscillator.stop(), 200);
        } catch (e) {

        }

        container.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                        background: white; padding: 2rem; border-radius: 8px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 1000; text-align: center; border: 2px solid var(--green-primary);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
                <h3 style="color: var(--green-dark); margin-bottom: 0.5rem;">Success!</h3>
                <p style="color: var(--gray-700); font-size: 1.1rem;">${message}</p>
                <button onclick="this.parentElement.remove()" class="btn btn-primary" style="margin-top: 1rem;">OK</button>
            </div>
        `;

        setTimeout(() => {
            if (container.innerHTML.includes('Success!')) {
                container.innerHTML = '';
            }
        }, 3000);
    } else {

        container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
        setTimeout(() => {
            container.innerHTML = '';
        }, 5000);
    }
}
