let dashboardPollInterval = null;
let allUpcomingSessions = [];
let allRecentSessions = [];

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await requireAuth();
    if (!auth) return;

    await loadDashboard();

    dashboardPollInterval = setInterval(async () => {
        console.log('Auto-refreshing dashboard...');
        await loadDashboard(true);
    }, 3000);
});

function applyFilters() {
    const status = document.getElementById('filterStatus')?.value || '';
    const startDate = document.getElementById('filterStartDate')?.value || '';
    const endDate = document.getElementById('filterEndDate')?.value || '';

    let filteredUpcoming = [...allUpcomingSessions];
    let filteredRecent = [...allRecentSessions];

    if (status) {
        filteredUpcoming = filteredUpcoming.filter(s => s.status === status);
        filteredRecent = filteredRecent.filter(s => s.status === status);
    }

    if (startDate) {
        const start = new Date(startDate);
        filteredUpcoming = filteredUpcoming.filter(s => new Date(s.scheduledTime || s.createdAt) >= start);
        filteredRecent = filteredRecent.filter(s => new Date(s.createdAt) >= start);
    }

    if (endDate) {
        const end = new Date(endDate + 'T23:59:59');
        filteredUpcoming = filteredUpcoming.filter(s => new Date(s.scheduledTime || s.createdAt) <= end);
        filteredRecent = filteredRecent.filter(s => new Date(s.createdAt) <= end);
    }

    renderUpcomingSessions(filteredUpcoming);
    renderRecentSessions(filteredRecent);
}

function clearFilters() {
    const statusEl = document.getElementById('filterStatus');
    const startDateEl = document.getElementById('filterStartDate');
    const endDateEl = document.getElementById('filterEndDate');

    if (statusEl) statusEl.value = '';
    if (startDateEl) startDateEl.value = '';
    if (endDateEl) endDateEl.value = '';

    renderUpcomingSessions(allUpcomingSessions);
    renderRecentSessions(allRecentSessions);
}

function renderUpcomingSessions(sessions) {
    const upcomingList = document.getElementById('upcomingSessions');
    if (sessions && sessions.length > 0) {
        upcomingList.innerHTML = sessions.map(session => {
            const pointCost = session.pointCost !== undefined && session.pointCost !== null ? session.pointCost : 10;
            const costDisplay = pointCost === 0 ? 'Free' : `${pointCost} points`;
            const userId = window.currentUserId;

            const isTutorForSession = session.tutorId === parseInt(userId);
            const isTuteeForSession = session.tuteeId === parseInt(userId);

            const hasConfirmed = isTutorForSession ? session.tutorConfirmed : session.tuteeConfirmed;
            const otherConfirmed = isTutorForSession ? session.tuteeConfirmed : session.tutorConfirmed;

            const canComplete = (isTutorForSession || isTuteeForSession) &&
                               (session.status === 'scheduled') &&
                               !hasConfirmed;

            const canCancel = (isTutorForSession || isTuteeForSession) &&
                             (session.status === 'scheduled' || session.status === 'requested');

            const waitingForOther = hasConfirmed && !otherConfirmed && session.status !== 'completed';

            return `
                <li class="list-group-item">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="flex: 1; min-width: 200px;">
                            <strong>Session #${session.id}</strong>
                            <div style="color: var(--gray-600); font-size: 0.875rem;">
                                ${new Date(session.scheduledTime).toLocaleString()}
                            </div>
                            <div style="color: var(--green-dark); font-size: 0.875rem; margin-top: 0.25rem;">
                                💰 Cost: ${costDisplay}
                            </div>
                            ${waitingForOther ? `<div style="color: var(--orange-primary); font-size: 0.875rem; font-weight: bold;">⌛ Waiting for other party to confirm</div>` : ''}
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                            <span class="badge badge-primary">${session.status}</span>
                            ${canComplete ? `<button onclick="completeSession(${session.id})" class="btn btn-success btn-sm" style="padding: 0.375rem 0.75rem;">✓ ${otherConfirmed ? 'Confirm & Complete' : 'Mark Complete'}</button>` : ''}
                            ${canCancel ? `<button onclick="cancelSession(${session.id}, '${session.status}')" class="btn btn-danger btn-sm" style="padding: 0.375rem 0.75rem;">✕ Cancel</button>` : ''}
                        </div>
                    </div>
                </li>
            `;
        }).join('');
    } else {
        upcomingList.innerHTML = '<li class="list-group-item">No upcoming sessions</li>';
    }
}

function renderRecentSessions(sessions) {
    const recentList = document.getElementById('recentSessions');
    if (sessions && sessions.length > 0) {
        recentList.innerHTML = sessions.map(session => {
            const badgeClass = session.status === 'completed' ? 'badge-success' :
                              session.status === 'cancelled' ? 'badge-danger' : 'badge-warning';
            const pointCost = session.pointCost !== undefined && session.pointCost !== null ? session.pointCost : 10;
            const costDisplay = pointCost === 0 ? 'Free' : `${pointCost} points`;
            const userId = window.currentUserId;

            const isTutorForSession = session.tutorId === parseInt(userId);
            const isTuteeForSession = session.tuteeId === parseInt(userId);

            const hasConfirmed = isTutorForSession ? session.tutorConfirmed : session.tuteeConfirmed;
            const otherConfirmed = isTutorForSession ? session.tuteeConfirmed : session.tutorConfirmed;

            const canComplete = (isTutorForSession || isTuteeForSession) &&
                               (session.status === 'scheduled') &&
                               !hasConfirmed;

            const canRate = isTuteeForSession && session.status === 'completed' && !session.hasRated;

            return `
                <li class="list-group-item">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="flex: 1; min-width: 200px;">
                            <strong>Session #${session.id}</strong>
                            <div style="color: var(--gray-600); font-size: 0.875rem;">
                                ${new Date(session.createdAt).toLocaleDateString()}
                            </div>
                            <div style="color: var(--green-dark); font-size: 0.875rem; margin-top: 0.25rem;">💰 Cost: ${costDisplay}</div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                            <span class="badge ${badgeClass}">${session.status}</span>
                            ${canComplete ? `<button onclick="completeSession(${session.id})" class="btn btn-success btn-sm" style="padding: 0.375rem 0.75rem;">✓ ${otherConfirmed ? 'Confirm' : 'Complete'}</button>` : ''}
                            ${canRate ? `<button onclick="showRatingModal(${session.id})" class="btn btn-warning btn-sm" style="padding: 0.375rem 0.75rem;">⭐ Rate</button>` : ''}
                        </div>
                    </div>
                </li>
            `;
        }).join('');
    } else {
        recentList.innerHTML = '<li class="list-group-item">No recent sessions</li>';
    }
}

window.addEventListener('beforeunload', () => {
    if (dashboardPollInterval) {
        clearInterval(dashboardPollInterval);
    }
});

async function loadDashboard(silent = false) {
    const { data, response } = await apiCall('/dashboard');

    if (!silent) {
        console.log('Dashboard API response:', { data, status: response?.status });
    }

    if (data.error) {
        console.error('Dashboard error:', data.error);
        if (data.error === 'Unauthorized' || response?.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        if (data.error === 'User not found' || response?.status === 404) {
            showNotification('User account not found. Please register again.', 'error');
            deleteCookie('sessionId');
            setTimeout(() => { window.location.href = '/register.html'; }, 2000);
            return;
        }
        showNotification('Failed to load dashboard: ' + data.error, 'error');
        return;
    }

    document.getElementById('pointsBalance').textContent = data.pointsBalance || 0;
    document.getElementById('upcomingCount').textContent = data.upcomingSessions?.length || 0;
    document.getElementById('accountType').textContent = data.user?.isTutor ? 'Tutor' : 'Student';

    window.currentUserId = data.user?.id;
    allUpcomingSessions = data.upcomingSessions || [];
    allRecentSessions = data.recentSessions || [];

    const status = document.getElementById('filterStatus')?.value || '';
    const startDate = document.getElementById('filterStartDate')?.value || '';
    const endDate = document.getElementById('filterEndDate')?.value || '';

    if (status || startDate || endDate) {
        applyFilters();
    } else {
        renderUpcomingSessions(allUpcomingSessions);
        renderRecentSessions(allRecentSessions);
    }

    if (data.user && data.user.isTutor) {
        await loadPendingRequests();
    } else {

        document.getElementById('pendingRequestsSection').style.display = 'none';
    }

    await loadAnnouncements();
}

async function loadPendingRequests() {
    try {
        const { data } = await apiCall('/sessions/pending-requests');
        const container = document.getElementById('pendingRequestsContainer');
        const section = document.getElementById('pendingRequestsSection');

        if (!container || !section) return;

        if (data.error) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 1rem;">Unable to load pending requests</p>';
            section.style.display = 'none';
            return;
        }

        const requests = data.requests || [];

        if (requests.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 1rem;">No pending session requests</p>';
            section.style.display = 'block';
            return;
        }

        section.style.display = 'block';

        container.innerHTML = requests.map(request => {
            const scheduledDate = new Date(request.scheduledTime);
            const formattedDate = scheduledDate.toLocaleString();
            const pointCost = request.pointCost !== undefined && request.pointCost !== null ? request.pointCost : 10;
            const costDisplay = pointCost === 0 ? 'Free' : `${pointCost} points`;

            return `
                <div style="padding: 1.25rem; margin-bottom: 1rem; background: var(--yellow-bg); border-radius: 8px; border: 2px solid var(--yellow-primary);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                        <div style="flex: 1; min-width: 200px;">
                            <h4 style="margin: 0 0 0.5rem 0; color: var(--green-dark);">
                                ${request.tutee ? (request.tutee.fullName || request.tutee.email) : 'Unknown Student'}
                            </h4>
                            <p style="margin: 0.25rem 0; color: var(--gray-700);">
                                <strong>Skill:</strong> ${request.skill ? request.skill.name : 'Unknown'}
                            </p>
                            <p style="margin: 0.25rem 0; color: var(--gray-700);">
                                <strong>Scheduled:</strong> ${formattedDate}
                            </p>
                            <p style="margin: 0.25rem 0; color: var(--green-dark);">
                                <strong>💰 Cost:</strong> ${costDisplay}
                            </p>
                            <p style="margin: 0.25rem 0; color: var(--gray-600); font-size: 0.875rem;">
                                Requested ${new Date(request.createdAt).toLocaleString()}
                            </p>
                        </div>
                        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                            <button onclick="acceptSessionRequest(${request.id})" class="btn btn-success" style="padding: 0.5rem 1rem;">
                                ✓ Accept
                            </button>
                            <button onclick="rejectSessionRequest(${request.id})" class="btn btn-danger" style="padding: 0.5rem 1rem;">
                                ✗ Reject
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading pending requests:', error);
        const container = document.getElementById('pendingRequestsContainer');
        const section = document.getElementById('pendingRequestsSection');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 1rem;">Unable to load pending requests</p>';
        }
        if (section) {
            section.style.display = 'none';
        }
    }
}

async function acceptSessionRequest(sessionId) {
    const confirmed = await showConfirm('Are you sure you want to accept this session request?', 'Accept Request');
    if (!confirmed) return;

    try {
        const { data } = await apiCall('/sessions/accept', {
            method: 'POST',
            body: { sessionId }
        });

        if (data.success) {
            showNotification('Session request accepted!', 'success');
            await loadDashboard();
        } else {
            showNotification(data.error || 'Failed to accept session request', 'error');
        }
    } catch (error) {
        console.error('Error accepting session request:', error);
        showNotification('Failed to accept session request', 'error');
    }
}

async function rejectSessionRequest(sessionId) {
    const confirmed = await showConfirm('Are you sure you want to reject this session request? This action cannot be undone.', 'Reject Request');
    if (!confirmed) return;

    try {
        const { data } = await apiCall('/sessions/reject', {
            method: 'POST',
            body: { sessionId }
        });

        if (data.success) {
            showNotification('Session request rejected.', 'info');
            await loadDashboard();
        } else {
            showNotification(data.error || 'Failed to reject session request', 'error');
        }
    } catch (error) {
        console.error('Error rejecting session request:', error);
        showNotification('Failed to reject session request', 'error');
    }
}

async function cancelSession(sessionId, status) {
    const message = status === 'scheduled'
        ? 'Are you sure you want to cancel this session? A 50 point penalty will be applied for cancelling a scheduled session.'
        : 'Are you sure you want to cancel this request?';

    const confirmed = await showConfirm(message, 'Cancel Session');
    if (!confirmed) return;

    try {
        const { data } = await apiCall('/sessions/cancel', {
            method: 'POST',
            body: { sessionId }
        });

        if (data.success) {
            showNotification(data.message || 'Session cancelled successfully', 'info');
            await loadDashboard();
        } else {
            showNotification(data.error || 'Failed to cancel session', 'error');
        }
    } catch (error) {
        console.error('Error cancelling session:', error);
        showNotification('Failed to cancel session', 'error');
    }
}

async function completeSession(sessionId) {
    const confirmed = await showConfirm('Mark this session as completed? Both tutor and student must confirm.', 'Complete Session');
    if (!confirmed) return;

    try {
        const { data } = await apiCall('/sessions/complete', {
            method: 'POST',
            body: { sessionId }
        });

        if (data.success) {
            if (data.message) {
                showNotification(data.message, 'success');
            } else {
                showNotification('Session updated!', 'success');
            }
            await loadDashboard();
        } else {
            showNotification(data.error || 'Failed to complete session', 'error');
        }
    } catch (error) {
        console.error('Error completing session:', error);
        showNotification('Failed to complete session', 'error');
    }
}

function showRatingModal(sessionId) {
    const modal = document.getElementById('ratingModal');
    const sessionIdInput = document.getElementById('ratingSessionId');
    if (sessionIdInput) {
        sessionIdInput.value = sessionId;
    }
    if (modal) {
        modal.classList.add('active');

        document.getElementById('ratingForm').reset();
        document.getElementById('ratingStars').innerHTML = '';
        document.getElementById('ratingValue').value = '';
        renderStarRating(0);
    }
}

function renderStarRating(rating) {
    const container = document.getElementById('ratingStars');
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.textContent = i <= rating ? '★' : '☆';
        star.style.fontSize = '2rem';
        star.style.cursor = 'pointer';
        star.style.color = i <= rating ? '#fbbf24' : '#d1d5db';
        star.style.marginRight = '0.25rem';
        star.onclick = () => {
            document.getElementById('ratingValue').value = i;
            renderStarRating(i);
        };
        container.appendChild(star);
    }
}

async function submitRating(e) {
    e.preventDefault();
    const sessionId = document.getElementById('ratingSessionId').value;
    const rating = document.getElementById('ratingValue').value;
    const comment = document.getElementById('ratingComment').value;

    if (!rating) {
        showNotification('Please select a rating', 'warning');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
        const { data } = await apiCall('/reviews', {
            method: 'POST',
            body: {
                sessionId: parseInt(sessionId),
                rating: parseInt(rating),
                comment: comment || null
            }
        });

        if (data.success) {
            showNotification('Thank you for your rating!', 'success');
            document.getElementById('ratingModal').classList.remove('active');
            await loadDashboard();
        } else {

            if (data.error && data.error.includes('already reviewed')) {
                showNotification('You have already rated this session.', 'warning');
            } else {
                showNotification(data.error || 'Failed to submit rating', 'error');
            }
        }
    } catch (error) {
        console.error('Error submitting rating:', error);
        showNotification('Failed to submit rating. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function loadAnnouncements() {
    try {
        const { data } = await apiCall('/announcements');
        const container = document.getElementById('announcementsContainer');

        if (!container) return;

        if (data.error) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 1rem;">Unable to load announcements</p>';
            return;
        }

        const announcements = data.announcements || [];

        if (announcements.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 1rem;">No announcements at this time</p>';
            return;
        }

        container.innerHTML = announcements.map(announcement => {
            const date = new Date(announcement.createdAt).toLocaleString();
            return `
                <div style="padding: 1.25rem; margin-bottom: 1rem; background: linear-gradient(135deg, var(--yellow-bg) 0%, var(--white) 100%); border-left: 4px solid var(--yellow-primary); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                        <h4 style="margin: 0; color: var(--green-dark); font-size: 1.125rem;">${announcement.title}</h4>
                        <span style="color: var(--gray-500); font-size: 0.875rem; white-space: nowrap; margin-left: 1rem;">${date}</span>
                    </div>
                    <p style="margin: 0; color: var(--gray-700); white-space: pre-wrap; line-height: 1.6;">${announcement.content}</p>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading announcements:', error);
        const container = document.getElementById('announcementsContainer');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 1rem;">Unable to load announcements</p>';
        }
    }
}
