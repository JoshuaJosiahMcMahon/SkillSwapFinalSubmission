let adminPollInterval = null;
let currentAdminTab = 'users';

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await requireAuth();
    if (!auth) return;

    await loadAdminData();
    setupForms();

    adminPollInterval = setInterval(async () => {
        await loadAdminData(true);

        if (currentAdminTab === 'announcements') {
            await loadAnnouncements();
        } else if (currentAdminTab === 'skills') {
            await loadSkills();
        } else if (currentAdminTab === 'degrees') {
            await loadDegrees();
        } else if (currentAdminTab === 'reports') {
            await loadReports();
        }
    }, 3000);
});

window.addEventListener('beforeunload', () => {
    if (adminPollInterval) {
        clearInterval(adminPollInterval);
    }
});

function setupForms() {

    const skillForm = document.getElementById('createSkillForm');
    if (skillForm) {
        skillForm.addEventListener('submit', handleCreateSkill);
    }

    const announcementForm = document.getElementById('createAnnouncementForm');
    if (announcementForm) {
        announcementForm.addEventListener('submit', handleCreateAnnouncement);
    }

    const degreeForm = document.getElementById('createDegreeForm');
    if (degreeForm) {
        degreeForm.addEventListener('submit', handleCreateDegree);
    }
}

function showTab(tabName) {
    currentAdminTab = tabName;

    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });

    document.querySelectorAll('[id^="tab"]').forEach(btn => {
        if (btn.id.startsWith('tab')) {
            btn.className = btn.className.replace('btn-primary', 'btn-secondary');
        }
    });

    const content = document.getElementById(`tabContent${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (content) {
        content.style.display = 'block';
    }

    const btn = document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (btn) {
        btn.className = btn.className.replace('btn-secondary', 'btn-primary');
    }

    if (tabName === 'announcements') {
        loadAnnouncements();
    } else if (tabName === 'skills') {
        loadSkills();
    } else if (tabName === 'degrees') {
        loadDegrees();
    } else if (tabName === 'reports') {
        loadReports();
    } else if (tabName === 'users') {

        loadAdminData(true);
    }
}

let allUsers = [];

async function loadAdminData(silent = false) {
    try {

        const statsResponse = await apiCall('/admin/stats');
        if (statsResponse.data.error) {
            if (statsResponse.response?.status === 403) {
                if (!silent) {
                    showAlert('Admin access required. You must be an admin to view this page.', 'danger');
                    setTimeout(() => {
                        window.location.href = '/dashboard.html';
                    }, 2000);
                }
                return;
            }
            if (!silent) showAlert('Failed to load admin data: ' + statsResponse.data.error, 'danger');
            return;
        }

        const stats = statsResponse.data;
        document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('totalTutors').textContent = stats.totalTutors || 0;
        document.getElementById('totalSessions').textContent = stats.totalSessions || 0;
        document.getElementById('completedSessions').textContent = stats.completedSessions || 0;
        document.getElementById('totalSkills').textContent = stats.totalSkills || 0;

        if (currentAdminTab === 'users') {
            const usersResponse = await apiCall('/admin/users');
            if (usersResponse.data.users) {
                allUsers = usersResponse.data.users;

                const searchTerm = document.getElementById('adminUserSearch')?.value.toLowerCase() || '';
                const filteredUsers = searchTerm
                    ? allUsers.filter(u => u.email.toLowerCase().includes(searchTerm))
                    : allUsers;
                displayUsers(filteredUsers);
            }
        }

        const sessionsResponse = await apiCall('/admin/sessions');
        if (sessionsResponse.data.sessions) {
            displaySessions(sessionsResponse.data.sessions);
        }
    } catch (error) {
        if (!silent) {
            console.error('Error loading admin data:', error);
            showAlert('Failed to load admin data', 'danger');
        }
    }
}

function handleAdminUserSearch(query) {
    const searchTerm = query.toLowerCase();
    const filteredUsers = allUsers.filter(u => u.email.toLowerCase().includes(searchTerm));
    displayUsers(filteredUsers);
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!users || users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="padding: 2rem; text-align: center; color: var(--gray-500);">
                    No users found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(user => {
        const statusBadge = user.banned
            ? '<span class="badge badge-danger">Banned</span>'
            : '<span class="badge badge-success">Active</span>';

        return `
            <tr style="border-bottom: 1px solid var(--gray-200);">
                <td style="padding: 1rem;">${user.id}</td>
                <td style="padding: 1rem;">
                    <strong style="color: var(--green-dark);">${user.email}</strong>
                    ${user.isAdmin ? '<span class="badge badge-warning" style="margin-left: 0.5rem;">Admin</span>' : ''}
                </td>
                <td style="padding: 1rem;">${user.blockName || '-'}</td>
                <td style="padding: 1rem; text-align: center;">
                    ${user.isTutor ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-secondary">No</span>'}
                </td>
                <td style="padding: 1rem; text-align: center;">
                    <span class="badge badge-warning">${user.pointsBalance || 0}</span>
                </td>
                <td style="padding: 1rem; text-align: center;">${statusBadge}</td>
                <td style="padding: 1rem;">
                    <div style="display: flex; gap: 0.375rem; flex-wrap: nowrap; align-items: center;">
                        ${!user.isAdmin ? `
                            <button class="btn btn-danger" style="padding: 0.5rem 0.875rem; font-size: 0.8125rem; margin: 0.125rem;" onclick="handleDeleteUser(${user.id}, '${user.email}')">Delete</button>
                            <button class="btn btn-secondary" style="padding: 0.5rem 0.875rem; font-size: 0.8125rem; margin: 0.125rem;" onclick="handleToggleTutor(${user.id})">${user.isTutor ? 'Disable Tutor' : 'Enable Tutor'}</button>
                            <button class="btn btn-warning" style="padding: 0.5rem 0.875rem; font-size: 0.8125rem; margin: 0.125rem;" onclick="handleToggleAdmin(${user.id}, '${user.email}', false)">Make Admin</button>
                            <button class="btn btn-primary" style="padding: 0.5rem 0.875rem; font-size: 0.8125rem; margin: 0.125rem;" onclick="handleAdjustPoints(${user.id})">Points</button>
                            ${user.banned
                                ? `<button class="btn btn-success" style="padding: 0.5rem 0.875rem; font-size: 0.8125rem; margin: 0.125rem;" onclick="handleUnbanUser(${user.id})">Unban</button>`
                                : `<button class="btn btn-danger" style="padding: 0.5rem 0.875rem; font-size: 0.8125rem; margin: 0.125rem;" onclick="handleBanUser(${user.id}, '${user.email}')">Ban</button>`
                            }
                        ` : `
                            <button class="btn btn-danger" style="padding: 0.5rem 0.875rem; font-size: 0.8125rem; margin: 0.125rem;" onclick="handleToggleAdmin(${user.id}, '${user.email}', true)">Remove Admin</button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function displaySessions(sessions) {
    const tbody = document.getElementById('sessionsTableBody');
    if (!sessions || sessions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="padding: 2rem; text-align: center; color: var(--gray-500);">
                    No sessions found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = sessions.map(session => {
        const scheduledDate = session.scheduledTime ? new Date(session.scheduledTime).toLocaleString() : '-';
        const createdDate = session.createdAt ? new Date(session.createdAt).toLocaleString() : '-';

        let statusBadge = '';
        switch(session.status) {
            case 'completed':
                statusBadge = '<span class="badge badge-success">Completed</span>';
                break;
            case 'scheduled':
                statusBadge = '<span class="badge badge-primary">Scheduled</span>';
                break;
            case 'requested':
                statusBadge = '<span class="badge badge-warning">Requested</span>';
                break;
            case 'cancelled':
                statusBadge = '<span class="badge badge-danger">Cancelled</span>';
                break;
            default:
                statusBadge = `<span class="badge badge-secondary">${session.status}</span>`;
        }

        return `
            <tr style="border-bottom: 1px solid var(--gray-200);">
                <td style="padding: 1rem;">${session.id}</td>
                <td style="padding: 1rem;">Tutor ID: ${session.tutorId}</td>
                <td style="padding: 1rem;">Tutee ID: ${session.tuteeId}</td>
                <td style="padding: 1rem; text-align: center;">${statusBadge}</td>
                <td style="padding: 1rem; color: var(--gray-600);">${scheduledDate}</td>
                <td style="padding: 1rem; color: var(--gray-600);">${createdDate}</td>
            </tr>
        `;
    }).join('');
}

async function handleCreateSkill(e) {
    e.preventDefault();
    const name = document.getElementById('skillName').value;
    const category = document.getElementById('skillCategory').value;

    showAlert('Creating skill...', 'info');

    try {
        const { data } = await apiCall('/admin/skills/create', {
            method: 'POST',
            body: { name, category }
        });

        if (data.success) {
            showAlert('Skill created successfully!', 'success');
            document.getElementById('createSkillForm').reset();

            await loadAdminData();
            await loadSkills();
        } else {
            showAlert(data.error || 'Failed to create skill', 'danger');
        }
    } catch (error) {
        console.error('Error creating skill:', error);
        showAlert('Failed to create skill', 'danger');
    }
}

async function handleCreateDegree(e) {
    e.preventDefault();
    const name = document.getElementById('degreeName').value;

    showAlert('Creating degree...', 'info');

    try {
        const { data } = await apiCall('/admin/degrees/create', {
            method: 'POST',
            body: { name }
        });

        if (data.success) {
            showAlert('Degree created successfully!', 'success');
            document.getElementById('createDegreeForm').reset();
            await loadDegrees();
        } else {
            showAlert(data.error || 'Failed to create degree', 'danger');
        }
    } catch (error) {
        console.error('Error creating degree:', error);
        showAlert('Failed to create degree', 'danger');
    }
}

async function loadSkills() {
    try {
        const { data } = await apiCall('/admin/skills');
        if (data.skills) {
            displaySkills(data.skills);
        }
    } catch (error) {
        console.error('Error loading skills:', error);
    }
}

async function loadDegrees() {
    try {
        const { data } = await apiCall('/admin/degrees');
        if (data.degrees) {
            displayDegrees(data.degrees);
        }
    } catch (error) {
        console.error('Error loading degrees:', error);
    }
}

function displayDegrees(degrees) {
    const container = document.getElementById('degreesList');
    if (!degrees || degrees.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">No degrees found</p>';
        return;
    }

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--green-bg); border-bottom: 2px solid var(--green-primary);">
                        <th style="padding: 1rem; text-align: left;">ID</th>
                        <th style="padding: 1rem; text-align: left;">Name</th>
                        <th style="padding: 1rem; text-align: left;">Created</th>
                        <th style="padding: 1rem; text-align: center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${degrees.map(degree => {
                        const date = new Date(degree.createdAt).toLocaleDateString();
                        return `
                            <tr style="border-bottom: 1px solid var(--gray-200);">
                                <td style="padding: 1rem;">${degree.id}</td>
                                <td style="padding: 1rem;"><strong>${degree.name}</strong></td>
                                <td style="padding: 1rem; color: var(--gray-600);">${date}</td>
                                <td style="padding: 1rem; text-align: center;">
                                    <button class="btn btn-danger" style="padding: 0.5rem 0.875rem; font-size: 0.8125rem;" onclick="handleDeleteDegree(${degree.id}, '${degree.name}')">Delete</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function handleDeleteDegree(degreeId, degreeName) {
    const confirmed = await showConfirm(`Are you sure you want to delete the degree "${degreeName}"? This action cannot be undone.`, 'Delete Degree');
    if (!confirmed) return;

    showAlert('Deleting degree...', 'info');

    try {
        const { data } = await apiCall('/admin/degrees/delete', {
            method: 'POST',
            body: { degreeId }
        });

        if (data.success) {
            showAlert('Degree deleted successfully', 'success');
            await loadDegrees();
        } else {
            showAlert(data.error || 'Failed to delete degree', 'danger');
        }
    } catch (error) {
        console.error('Error deleting degree:', error);
        showAlert('Failed to delete degree', 'danger');
    }
}

function displaySkills(skills) {
    const container = document.getElementById('skillsList');
    if (!skills || skills.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">No skills found</p>';
        return;
    }

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--green-bg); border-bottom: 2px solid var(--green-primary);">
                        <th style="padding: 1rem; text-align: left;">ID</th>
                        <th style="padding: 1rem; text-align: left;">Name</th>
                        <th style="padding: 1rem; text-align: left;">Category</th>
                        <th style="padding: 1rem; text-align: left;">Created</th>
                        <th style="padding: 1rem; text-align: center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${skills.map(skill => {
                        const date = new Date(skill.createdAt).toLocaleDateString();
                        return `
                            <tr style="border-bottom: 1px solid var(--gray-200);">
                                <td style="padding: 1rem;">${skill.id}</td>
                                <td style="padding: 1rem;"><strong>${skill.name}</strong></td>
                                <td style="padding: 1rem;"><span class="badge badge-primary">${skill.category}</span></td>
                                <td style="padding: 1rem; color: var(--gray-600);">${date}</td>
                                <td style="padding: 1rem; text-align: center;">
                                    <button class="btn btn-danger" style="padding: 0.5rem 0.875rem; font-size: 0.8125rem;" onclick="handleDeleteSkill(${skill.id}, '${skill.name}')">Delete</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function handleDeleteSkill(skillId, skillName) {
    const confirmed = await showConfirm(`Are you sure you want to delete the skill "${skillName}"? This action cannot be undone.`, 'Delete Skill');
    if (!confirmed) return;

    showAlert('Deleting skill...', 'info');

    try {
        const { data } = await apiCall('/admin/skills/delete', {
            method: 'POST',
            body: { skillId }
        });

        if (data.success) {
            showAlert('Skill deleted successfully', 'success');
            await loadSkills();
            await loadAdminData();
        } else {
            showAlert(data.error || 'Failed to delete skill', 'danger');
        }
    } catch (error) {
        console.error('Error deleting skill:', error);
        showAlert('Failed to delete skill', 'danger');
    }
}

async function handleDeleteUser(userId, email) {
    const confirmed = await showConfirm(`Are you sure you want to delete user ${email}? This action cannot be undone.`, 'Delete User');
    if (!confirmed) return;

    showAlert('Deleting user...', 'info');

    try {
        const { data } = await apiCall('/admin/users/delete', {
            method: 'POST',
            body: { userId }
        });

        if (data.success) {
            showAlert('User deleted successfully', 'success');
            await loadAdminData();
        } else {
            showAlert(data.error || 'Failed to delete user', 'danger');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showAlert('Failed to delete user', 'danger');
    }
}

async function handleToggleTutor(userId) {
    showAlert('Updating tutor role...', 'info');

    try {
        const { data } = await apiCall('/admin/users/toggle-tutor', {
            method: 'POST',
            body: { userId }
        });

        if (data.success) {
            showAlert('Tutor role updated successfully', 'success');
            await loadAdminData();
        } else {
            showAlert(data.error || 'Failed to update tutor role', 'danger');
        }
    } catch (error) {
        console.error('Error toggling tutor role:', error);
        showAlert('Failed to update tutor role', 'danger');
    }
}

async function handleToggleAdmin(userId, email, isCurrentlyAdmin) {
    const confirmMessage = isCurrentlyAdmin
        ? `Are you sure you want to remove admin privileges from ${email}? They will no longer have access to the admin dashboard.`
        : `Are you sure you want to grant admin privileges to ${email}? They will have full access to the admin dashboard.`;
    const confirmTitle = isCurrentlyAdmin ? 'Remove Admin Access' : 'Grant Admin Access';

    const confirmed = await showConfirm(confirmMessage, confirmTitle);
    if (!confirmed) return;

    showAlert('Updating admin status...', 'info');

    try {
        const { data } = await apiCall('/admin/users/toggle-admin', {
            method: 'POST',
            body: { userId }
        });

        if (data.success) {
            showAlert('User admin status updated successfully', 'success');
            await loadAdminData();
        } else {
            showAlert(data.error || 'Failed to update admin status', 'danger');
        }
    } catch (error) {
        console.error('Error updating admin status:', error);
        showAlert('Failed to update admin status', 'danger');
    }
}

async function handleAdjustPoints(userId) {
    const points = await showPrompt('Enter points to add (positive) or remove (negative):\nExample: +50 to add, -25 to remove', '', 'Adjust Points');
    if (points === null) return;

    const pointsNum = parseInt(points);
    if (isNaN(pointsNum)) {
        showAlert('Invalid points amount', 'danger');
        return;
    }

    showAlert(`${pointsNum > 0 ? 'Adding' : 'Removing'} points...`, 'info');

    try {
        const { data } = await apiCall('/admin/users/adjust-points', {
            method: 'POST',
            body: { userId, points: pointsNum }
        });

        if (data.success) {
            showAlert(data.message || 'Points updated successfully', 'success');
            await loadAdminData();
        } else {
            showAlert(data.error || 'Failed to adjust points', 'danger');
        }
    } catch (error) {
        console.error('Error adjusting points:', error);
        showAlert('Failed to adjust points', 'danger');
    }
}

async function handleBanUser(userId, email) {
    const confirmed = await showConfirm(`Are you sure you want to ban user ${email}?`, 'Ban User');
    if (!confirmed) return;

    const banReason = await showPrompt(`Enter reason for banning ${email}:`, 'Your account has been banned from using SkillSwap due to violation of our terms of service. Please contact the administrator if you believe this is an error.', 'Ban Reason');

    if (banReason === null) {

        return;
    }

    if (!banReason || banReason.trim().length === 0) {
        showAlert('Ban reason is required', 'danger');
        return;
    }

    showAlert('Banning user...', 'info');

    try {
        const { data } = await apiCall('/admin/users/ban', {
            method: 'POST',
            body: { userId, banReason: banReason.trim() }
        });

        if (data.success) {
            showAlert('User banned successfully', 'success');
            await loadAdminData();
        } else {
            showAlert(data.error || 'Failed to ban user', 'danger');
        }
    } catch (error) {
        console.error('Error banning user:', error);
        showAlert('Failed to ban user', 'danger');
    }
}

async function handleUnbanUser(userId) {
    showAlert('Unbanning user...', 'info');

    try {
        const { data } = await apiCall('/admin/users/unban', {
            method: 'POST',
            body: { userId }
        });

        if (data.success) {
            showAlert('User unbanned successfully', 'success');
            await loadAdminData();
        } else {
            showAlert(data.error || 'Failed to unban user', 'danger');
        }
    } catch (error) {
        console.error('Error unbanning user:', error);
        showAlert('Failed to unban user', 'danger');
    }
}

async function handleCreateAnnouncement(e) {
    e.preventDefault();
    const title = document.getElementById('announcementTitle').value;
    const content = document.getElementById('announcementContent').value;

    showAlert('Creating announcement...', 'info');

    try {
        const { data } = await apiCall('/admin/announcements/create', {
            method: 'POST',
            body: { title, content }
        });

        if (data.success) {
            showAlert('Announcement created successfully!', 'success');
            document.getElementById('createAnnouncementForm').reset();
            await loadAnnouncements();
        } else {
            showAlert(data.error || 'Failed to create announcement', 'danger');
        }
    } catch (error) {
        console.error('Error creating announcement:', error);
        showAlert('Failed to create announcement', 'danger');
    }
}

async function loadAnnouncements() {
    try {
        const { data } = await apiCall('/admin/announcements');
        if (data.announcements) {
            displayAnnouncements(data.announcements);
        }
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

function displayAnnouncements(announcements) {
    const container = document.getElementById('announcementsList');
    if (!announcements || announcements.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">No announcements yet</p>';
        return;
    }

    container.innerHTML = announcements.map(announcement => {
        const date = new Date(announcement.createdAt).toLocaleString();
        return `
            <div class="card" style="margin-bottom: 1rem; background: ${announcement.isActive ? 'var(--white)' : 'var(--gray-100)'};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h4 style="margin: 0; color: var(--green-dark);">${announcement.title}</h4>
                        <p style="margin: 0.5rem 0 0 0; color: var(--gray-600); font-size: 0.875rem;">Posted: ${date}</p>
                    </div>
                    <button class="btn btn-danger" style="padding: 0.375rem 0.75rem; font-size: 0.875rem;" onclick="handleDeleteAnnouncement(${announcement.id})">Delete</button>
                </div>
                <p style="margin: 0; color: var(--gray-700); white-space: pre-wrap;">${announcement.content}</p>
            </div>
        `;
    }).join('');
}

async function handleDeleteAnnouncement(announcementId) {
    const confirmed = await showConfirm('Are you sure you want to delete this announcement?', 'Delete Announcement');
    if (!confirmed) return;

    showAlert('Deleting announcement...', 'info');

    try {
        const { data } = await apiCall('/admin/announcements/delete', {
            method: 'POST',
            body: { announcementId }
        });

        if (data.success) {
            showAlert('Announcement deleted successfully', 'success');
            await loadAnnouncements();
        } else {
            showAlert(data.error || 'Failed to delete announcement', 'danger');
        }
    } catch (error) {
        console.error('Error deleting announcement:', error);
        showAlert('Failed to delete announcement', 'danger');
    }
}

function showAlert(message, type) {
    const container = document.getElementById('alertContainer');
    if (!message) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

async function loadReports() {
    try {
        const { data } = await apiCall('/admin/reports');
        if (data.reports) {
            displayReports(data.reports);
        }
    } catch (error) {
        console.error('Error loading reports:', error);
        showAlert('Failed to load reports', 'danger');
    }
}

async function displayReports(reports) {
    const tbody = document.getElementById('reportsTableBody');
    if (!tbody) return;

    if (!reports || reports.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="padding: 2rem; text-align: center; color: var(--gray-500);">
                    No reports found
                </td>
            </tr>
        `;
        return;
    }

    const usersResponse = await apiCall('/admin/users');
    const allUsers = usersResponse.data?.users || [];

    const enrichedReports = reports.map((report) => {
        const reporter = allUsers.find(u => u.id === report.reporterId);
        const reported = allUsers.find(u => u.id === report.reportedUserId);

        return {
            ...report,
            reporterEmail: reporter?.email || 'Unknown',
            reportedEmail: reported?.email || 'Unknown'
        };
    });

    tbody.innerHTML = enrichedReports.map(report => {
        const statusBadge = {
            'pending': 'badge-warning',
            'reviewed': 'badge-info',
            'resolved': 'badge-success',
            'dismissed': 'badge-secondary'
        }[report.status] || 'badge-secondary';

        return `
            <tr style="border-bottom: 1px solid var(--gray-200);">
                <td style="padding: 1rem;">${report.id}</td>
                <td style="padding: 1rem;">${report.reporterEmail}</td>
                <td style="padding: 1rem;">${report.reportedEmail}</td>
                <td style="padding: 1rem;"><strong>${report.reason}</strong></td>
                <td style="padding: 1rem; max-width: 300px; word-wrap: break-word;">${report.description || '-'}</td>
                <td style="padding: 1rem;">
                    <span class="badge ${statusBadge}">${report.status}</span>
                </td>
                <td style="padding: 1rem; color: var(--gray-600);">
                    ${new Date(report.createdAt).toLocaleDateString()}
                </td>
                <td style="padding: 1rem;">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-info btn-sm" onclick="viewReportDetails(${report.id})" style="padding: 0.375rem 0.75rem;">View</button>
                        ${report.status === 'pending' || report.status === 'reviewed' ? `
                            <button class="btn btn-success btn-sm" onclick="resolveReport(${report.id})" style="padding: 0.375rem 0.75rem;">Resolve</button>
                            <button class="btn btn-secondary btn-sm" onclick="dismissReport(${report.id})" style="padding: 0.375rem 0.75rem;">Dismiss</button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function resolveReport(reportId) {
    const notes = await showPrompt('Enter resolution notes (optional):', '', 'Resolve Report');
    if (notes === null) return;

    await updateReportStatus(reportId, 'resolved', notes);
}

async function dismissReport(reportId) {
    const notes = await showPrompt('Enter dismissal notes (optional):', '', 'Dismiss Report');
    if (notes === null) return;

    await updateReportStatus(reportId, 'dismissed', notes);
}

async function updateReportStatus(reportId, status, notes) {
    showAlert(`Marking report as ${status}...`, 'info');

    try {
        const { data } = await apiCall('/admin/reports/resolve', {
            method: 'POST',
            body: { reportId, status, notes }
        });

        if (data.success) {
            showAlert(`Report marked as ${status}`, 'success');
            await loadReports();
        } else {
            showAlert(data.error || 'Failed to update report status', 'danger');
        }
    } catch (error) {
        console.error('Error updating report status:', error);
        showAlert('Failed to update report status', 'danger');
    }
}

function viewReportDetails(reportId) {

    showNotification('Report details view - Feature coming soon!', 'info');
}

async function downloadAnalyticsReport() {
    try {
        showAlert('Generating analytics report...', 'info');

        const startDate = document.getElementById('reportStartDate')?.value || '';
        const endDate = document.getElementById('reportEndDate')?.value || '';
        const reportType = document.getElementById('reportType')?.value || 'full';

        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (reportType) params.append('reportType', reportType);

        const queryString = params.toString() ? `?${params.toString()}` : '';

        const response = await fetch(`/api/admin/analytics/pdf${queryString}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to generate report');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        let filename = 'skillswap-analytics';
        if (startDate || endDate) {
            filename += `-${startDate || 'start'}-to-${endDate || 'end'}`;
        }
        filename += `-${new Date().toISOString().split('T')[0]}.pdf`;
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showAlert('Analytics report downloaded successfully!', 'success');
    } catch (error) {
        console.error('Error downloading analytics report:', error);
        showAlert('Failed to download analytics report', 'danger');
    }
}

function clearReportDateRange() {
    const startDateEl = document.getElementById('reportStartDate');
    const endDateEl = document.getElementById('reportEndDate');
    const reportTypeEl = document.getElementById('reportType');
    
    if (startDateEl) startDateEl.value = '';
    if (endDateEl) endDateEl.value = '';
    if (reportTypeEl) reportTypeEl.value = 'full';
}
