let skills = [];
let currentTutorId = null;
const SEARCH_HISTORY_KEY = 'skillswap_search_history';
const MAX_SEARCH_HISTORY = 10;

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    await loadSkills();
    await populateDegreeSelect();
    setupSearchForm();
    displaySearchHistory();
});

function getSearchHistory() {
    try {
        const history = localStorage.getItem(SEARCH_HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch {
        return [];
    }
}

function saveSearchToHistory(criteria) {
    const history = getSearchHistory();
    const searchEntry = {
        ...criteria,
        timestamp: Date.now(),
        id: Date.now()
    };
    
    const isDuplicate = history.some(h => 
        h.skillId === criteria.skillId && 
        h.major === criteria.major && 
        h.blockName === criteria.blockName &&
        h.yearOfStudy === criteria.yearOfStudy
    );
    
    if (!isDuplicate && (criteria.skillId || criteria.major || criteria.blockName || criteria.yearOfStudy)) {
        history.unshift(searchEntry);
        if (history.length > MAX_SEARCH_HISTORY) {
            history.pop();
        }
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
        displaySearchHistory();
    }
}

function displaySearchHistory() {
    const container = document.getElementById('searchHistoryContainer');
    if (!container) return;
    
    const history = getSearchHistory();
    
    if (history.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-500); font-size: 0.875rem; text-align: center;">No recent searches</p>';
        return;
    }
    
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-weight: 600; color: var(--green-dark);">Recent Searches</span>
            <button onclick="clearSearchHistory()" class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Clear</button>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${history.map(h => {
                const skillName = skills.find(s => s.id === parseInt(h.skillId))?.name || '';
                const parts = [];
                if (skillName) parts.push(skillName);
                if (h.major) parts.push(h.major);
                if (h.blockName) parts.push(h.blockName);
                if (h.yearOfStudy) parts.push(`Year ${h.yearOfStudy}`);
                const label = parts.join(' • ') || 'All';
                return `
                    <button onclick="applySearchHistory(${h.id})" class="badge badge-primary" style="cursor: pointer; padding: 0.5rem 0.75rem; font-size: 0.8rem; border: none;">
                        🔍 ${label}
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

function applySearchHistory(historyId) {
    const history = getSearchHistory();
    const entry = history.find(h => h.id === historyId);
    if (!entry) return;
    
    document.getElementById('skillId').value = entry.skillId || '';
    document.getElementById('major').value = entry.major || '';
    document.getElementById('blockName').value = entry.blockName || '';
    document.getElementById('yearOfStudy').value = entry.yearOfStudy || '';
    
    document.getElementById('searchForm').dispatchEvent(new Event('submit'));
}

function clearSearchHistory() {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    displaySearchHistory();
}

async function populateDegreeSelect() {
    try {
        const { data } = await apiCall('/degrees');
        const select = document.getElementById('major');
        if (!select) return;

        if (data.degrees) {
            select.innerHTML = '<option value="">All Degrees</option>';
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

async function loadSkills() {
    const { data } = await apiCall('/skills');
    if (data.skills) {
        skills = data.skills;
        populateSkillSelects();
    }
}

function populateSkillSelects() {
    const searchSelect = document.getElementById('skillId');
    const bookingSelect = document.getElementById('bookingSkillId');

    skills.forEach(skill => {
        const option = `<option value="${skill.id}">${skill.name} (${skill.category})</option>`;
        if (searchSelect) searchSelect.innerHTML += option;
        if (bookingSelect) bookingSelect.innerHTML += option;
    });
}

function setupSearchForm() {
    const form = document.getElementById('searchForm');
    if (form) {
        form.addEventListener('submit', handleSearch);
    }
}

async function handleSearch(e) {
    e.preventDefault();
    const criteria = {
        skillId: document.getElementById('skillId').value,
        major: document.getElementById('major').value,
        blockName: document.getElementById('blockName').value,
        yearOfStudy: document.getElementById('yearOfStudy').value
    };

    saveSearchToHistory(criteria);

    const query = new URLSearchParams();
    Object.entries(criteria).forEach(([key, value]) => {
        if (value) query.append(key, value);
    });

    const { data } = await apiCall(`/search/tutors?${query.toString()}`);
    displayResults(data.tutors || []);
}

function displayResults(tutors) {
    const container = document.getElementById('resultsContainer');

    if (!tutors || tutors.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 3rem;">
                <p style="font-size: 1.25rem; color: var(--gray-600); margin-bottom: 0.5rem;">
                    🔍 No tutors found
                </p>
                <p style="color: var(--gray-500);">
                    Try adjusting your search criteria
                </p>
            </div>
        `;
        return;
    }

    console.log('Tutors with profile pictures:', tutors.map(t => ({
        email: t.email,
        hasProfile: !!t.profile,
        hasPicture: !!(t.profile && t.profile.profilePicture),
        pictureUrl: t.profile?.profilePicture
    })));

    container.innerHTML = `
        <h2 style="margin-bottom: 1.5rem; color: var(--green-dark);">
            Search Results (${tutors.length})
        </h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
            ${tutors.map(tutor => {
                // Load rating for each tutor asynchronously (don't await, let it load in background)
                setTimeout(() => loadTutorRatingBadge(tutor.id), 100);
                return `
                <div class="card" style="padding: 1.5rem; transition: all 0.3s ease; border: 2px solid var(--gray-200);">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem;">
                        <div style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 3px solid var(--green-primary); background: var(--gray-200); position: relative;">
                            ${tutor.profile && tutor.profile.profilePicture ?
                                `<img src="${tutor.profile.profilePicture}?t=${Date.now()}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; display: block; position: relative; z-index: 1;" onerror="this.style.display='none'; const placeholder = this.parentElement.querySelector('.profile-placeholder'); if(placeholder) placeholder.style.display='flex';" onload="const placeholder = this.parentElement.querySelector('.profile-placeholder'); if(placeholder) placeholder.style.display='none';"><div class="profile-placeholder" style="width: 100%; height: 100%; background: linear-gradient(135deg, var(--green-primary) 0%, var(--teal-primary) 100%); display: none; align-items: center; justify-content: center; font-size: 2rem; color: var(--white); position: absolute; top: 0; left: 0; z-index: 0;">👤</div>` :
                                `<div style="width: 100%; height: 100%; background: linear-gradient(135deg, var(--green-primary) 0%, var(--teal-primary) 100%); display: flex; align-items: center; justify-content: center; font-size: 2rem; color: var(--white);">👤</div>`
                            }
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <h4 style="margin: 0; color: var(--green-dark); font-size: 1.125rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${tutor.fullName || tutor.firstName && tutor.lastName ? `${tutor.firstName} ${tutor.lastName}` : tutor.email}
                            </h4>
                            <p style="margin: 0.25rem 0 0 0; color: var(--gray-600); font-size: 0.875rem;">
                                📍 ${tutor.blockName || 'Not specified'}
                            </p>
                        </div>
                    </div>

                    <div style="margin-bottom: 1.25rem; padding-top: 1.25rem; border-top: 2px solid var(--gray-200);">
                        ${tutor.profile ? `
                            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                ${tutor.profile.major ? `
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <span style="font-size: 1.25rem;">🎓</span>
                                        <span style="color: var(--gray-700);"><strong>Major:</strong> ${tutor.profile.major}</span>
                                    </div>
                                ` : ''}
                                ${tutor.profile.yearOfStudy ? `
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <span style="font-size: 1.25rem;">📚</span>
                                        <span style="color: var(--gray-700);"><strong>Year:</strong> Year ${tutor.profile.yearOfStudy}</span>
                                    </div>
                                ` : ''}
                                ${tutor.profile.bio ? `
                                    <div style="margin-top: 0.5rem; padding: 0.75rem; background: var(--green-bg); border-radius: 8px; border-left: 3px solid var(--green-primary);">
                                        <p style="margin: 0; color: var(--gray-700); font-size: 0.9rem; line-height: 1.5;">
                                            ${tutor.profile.bio.length > 100 ? tutor.profile.bio.substring(0, 100) + '...' : tutor.profile.bio}
                                        </p>
                                    </div>
                                ` : ''}
                            </div>
                        ` : '<p style="color: var(--gray-500); font-style: italic;">No profile information available</p>'}
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem; padding-top: 1.25rem; border-top: 2px solid var(--gray-200); flex-wrap: wrap; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <span class="badge badge-warning" style="font-size: 0.875rem; padding: 0.5rem 1rem;">
                                ⭐ ${tutor.pointsBalance || 0} points
                            </span>
                            <span id="tutorRatingBadge_${tutor.id}" style="display: flex; align-items: center; gap: 0.25rem; color: var(--gray-700); font-size: 0.875rem;">
                                <span style="color: #fbbf24;">★</span>
                                <span>Loading...</span>
                            </span>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button class="btn btn-info btn-sm" onclick="openMessageToTutor(${tutor.id}, '${(tutor.fullName || tutor.email).replace(/'/g, "\\'")}')" style="padding: 0.5rem 1rem; font-size: 0.875rem;" title="Send Message">
                                💬 Message
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="openReportModal(${tutor.id}, '${(tutor.fullName || tutor.email).replace(/'/g, "\\'")}')" style="padding: 0.5rem 1rem; font-size: 0.875rem;" title="Report User">
                                🚩 Report
                            </button>
                            <button class="btn btn-warning btn-sm" onclick="openRatingsModal(${tutor.id})" style="padding: 0.5rem 1rem; font-size: 0.875rem;" title="View Ratings">
                                ⭐ Ratings
                            </button>
                            <button class="btn btn-primary" onclick="openBookingModal(${tutor.id}, '${tutor.fullName || tutor.email}')" style="padding: 0.625rem 1.5rem; font-size: 0.9rem;">
                                Book Session
                            </button>
                        </div>
                    </div>
                </div>
            `;
            }).join('')}
        </div>
    `;
}

let currentTutorForRatings = null;

function openBookingModal(tutorId, tutorEmail) {
    currentTutorId = tutorId;
    currentTutorForRatings = tutorId;
    document.getElementById('bookingTutorId').value = tutorId;
    document.getElementById('bookingTutorEmail').value = tutorEmail;
    document.getElementById('bookingForm').reset();
    document.getElementById('bookingTutorId').value = tutorId;
    document.getElementById('bookingTutorEmail').value = tutorEmail;

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('bookingDateTime').min = now.toISOString().slice(0, 16);

    document.getElementById('bookingModal').classList.add('active');
    document.getElementById('bookingAlert').innerHTML = '';

    // Load tutor rating
    loadTutorRating(tutorId);
}

async function loadTutorRating(tutorId) {
    try {
        const { data } = await apiCall(`/reviews/stats?userId=${tutorId}`);
        const ratingDisplay = document.getElementById('tutorRatingDisplay');

        if (data.averageRating && data.averageRating > 0) {
            const stars = '★'.repeat(Math.round(data.averageRating)) + '☆'.repeat(5 - Math.round(data.averageRating));
            ratingDisplay.innerHTML = `
                <span style="color: #fbbf24; font-size: 1.125rem;">${stars.substring(0, 5)}</span>
                <span style="color: var(--gray-700); font-weight: bold;">${data.averageRating.toFixed(1)}</span>
                <span style="color: var(--gray-600); font-size: 0.875rem;">(${data.totalReviews})</span>
            `;
        } else {
            ratingDisplay.innerHTML = `
                <span style="color: var(--gray-500); font-size: 0.875rem;">No ratings yet</span>
            `;
        }
    } catch (error) {
        console.error('Error loading tutor rating:', error);
        const ratingDisplay = document.getElementById('tutorRatingDisplay');
        ratingDisplay.innerHTML = `
            <span style="color: var(--gray-500); font-size: 0.875rem;">Unable to load rating</span>
        `;
    }
}

function viewTutorRatings() {
    if (!currentTutorForRatings) return;
    openRatingsModal(currentTutorForRatings);
}

function openRatingsModal(tutorId) {
    currentTutorForRatings = tutorId;
    document.getElementById('ratingsModal').classList.add('active');
    loadRatings(tutorId);
}

function closeRatingsModal() {
    document.getElementById('ratingsModal').classList.remove('active');
}

async function loadRatings(tutorId) {
    const content = document.getElementById('ratingsContent');
    content.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">Loading ratings...</p>';

    try {
        const { data } = await apiCall(`/reviews?userId=${tutorId}`);
        const currentUserId = parseInt(getCookie('sessionId'));

        if (data.error) {
            content.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">Unable to load ratings</p>';
            return;
        }

        const reviews = data.reviews || [];
        const averageRating = data.averageRating || 0;
        const totalReviews = data.totalReviews || 0;

        if (reviews.length === 0) {
            content.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <p style="color: var(--gray-500); margin-bottom: 1rem;">No ratings yet</p>
                    <p style="color: var(--gray-400); font-size: 0.875rem;">This tutor hasn't received any ratings yet.</p>
                </div>
            `;
            return;
        }

        const enrichedReviews = reviews.map((review) => ({
            ...review,
            reviewerName: review.reviewerId === currentUserId ? 'You' : 'Student',
            isOwnReview: review.reviewerId === currentUserId
        }));

        content.innerHTML = `
            <div style="margin-bottom: 2rem; padding: 1.5rem; background: var(--green-bg); border-radius: 8px; text-align: center;">
                <div style="font-size: 2.5rem; color: #fbbf24; margin-bottom: 0.5rem;">
                    ${'★'.repeat(Math.round(averageRating))}${'☆'.repeat(5 - Math.round(averageRating))}
                </div>
                <div style="font-size: 1.5rem; font-weight: bold; color: var(--green-dark); margin-bottom: 0.25rem;">
                    ${averageRating.toFixed(1)} out of 5.0
                </div>
                <div style="color: var(--gray-600); font-size: 0.875rem;">
                    Based on ${totalReviews} ${totalReviews === 1 ? 'review' : 'reviews'}
                </div>
            </div>
            <div style="max-height: 400px; overflow-y: auto;">
                <h3 style="margin-bottom: 1rem; color: var(--green-dark);">All Reviews</h3>
                ${enrichedReviews.map(review => {
                    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                    const date = new Date(review.createdAt).toLocaleDateString();
                    return `
                        <div style="padding: 1rem; margin-bottom: 1rem; background: var(--white); border: 1px solid var(--gray-200); border-radius: 8px; ${review.isOwnReview ? 'border-left: 3px solid var(--green-primary);' : ''}">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                                <div>
                                    <div style="color: #fbbf24; font-size: 1.125rem; margin-bottom: 0.25rem;">${stars}</div>
                                    <div style="color: var(--gray-700); font-weight: 500;">${review.reviewerName}</div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <span style="color: var(--gray-500); font-size: 0.875rem;">${date}</span>
                                    ${review.isOwnReview ? `
                                        <button onclick="deleteReview(${review.id}, ${tutorId})" class="btn btn-danger btn-sm" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                                            🗑️ Delete
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                            ${review.comment ? `
                                <div style="color: var(--gray-700); margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--gray-200);">
                                    ${review.comment}
                                </div>
                            ` : '<div style="color: var(--gray-400); font-style: italic; margin-top: 0.75rem;">No comment provided</div>'}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Error loading ratings:', error);
        content.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">Unable to load ratings</p>';
    }
}

async function deleteReview(reviewId, tutorId) {
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
        return;
    }

    try {
        const { data } = await apiCall('/reviews', {
            method: 'DELETE',
            body: { reviewId }
        });

        if (data.success) {
            showNotification('Review deleted successfully', 'success');
            await loadRatings(tutorId);
        } else {
            showNotification(data.error || 'Failed to delete review', 'error');
        }
    } catch (error) {
        console.error('Error deleting review:', error);
        showNotification('Failed to delete review', 'error');
    }
}

function closeBookingModal() {
    document.getElementById('bookingModal').classList.remove('active');
}

async function submitBooking() {
    const tutorId = document.getElementById('bookingTutorId').value;
    const skillId = document.getElementById('bookingSkillId').value;
    const scheduledTime = document.getElementById('bookingDateTime').value;
    const pointCost = document.getElementById('bookingPointCost').value;

    if (!skillId || !scheduledTime || !pointCost) {
        showBookingAlert('Please fill in all required fields', 'danger');
        return;
    }

    const cost = parseInt(pointCost);
    if (isNaN(cost) || cost < 0) {
        showBookingAlert('Point cost cannot be negative', 'danger');
        return;
    }

    const selectedDate = new Date(scheduledTime);
    if (selectedDate < new Date()) {
        showBookingAlert('Please select a future date and time', 'danger');
        return;
    }

    showBookingAlert('Booking session...', 'info');

    const { data } = await apiCall('/sessions/book', {
        method: 'POST',
        body: {
            tutorId: parseInt(tutorId),
            skillId: parseInt(skillId),
            scheduledTime,
            pointCost: cost
        }
    });

    if (data.success) {
        showBookingAlert('Session booked successfully! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1500);
    } else {
        showBookingAlert(data.error || 'Failed to book session', 'danger');
    }
}

function showBookingAlert(message, type) {
    const container = document.getElementById('bookingAlert');
    if (!message) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

// Close modal on outside click
document.getElementById('bookingModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'bookingModal') {
        closeBookingModal();
    }
});

document.getElementById('ratingsModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'ratingsModal') {
        closeRatingsModal();
    }
});

// Report modal functions
let currentReportedUserId = null;
let currentReportedUserEmail = null;

function openReportModal(userId, userEmail) {
    currentReportedUserId = userId;
    currentReportedUserEmail = userEmail;
    document.getElementById('reportedUserId').value = userId;
    document.getElementById('reportForm').reset();
    document.getElementById('reportedUserId').value = userId;
    document.getElementById('reportAlert').innerHTML = '';
    document.getElementById('reportModal').classList.add('active');
}

function closeReportModal() {
    document.getElementById('reportModal').classList.remove('active');
    currentReportedUserId = null;
    currentReportedUserEmail = null;
}

async function handleReportSubmit(e) {
    e.preventDefault();
    const reportedUserId = document.getElementById('reportedUserId').value;
    const reason = document.getElementById('reportReason').value;
    const description = document.getElementById('reportDescription').value;

    if (!reason) {
        showReportAlert('Please select a reason for reporting', 'danger');
        return;
    }

    showReportAlert('Submitting report...', 'info');

    try {
        const { data } = await apiCall('/reports', {
            method: 'POST',
            body: {
                reportedUserId: parseInt(reportedUserId),
                reason,
                description: description || null
            }
        });

        if (data.success) {
            showReportAlert('Report submitted successfully. Thank you for helping keep SkillSwap safe!', 'success');
            setTimeout(() => {
                closeReportModal();
            }, 2000);
        } else {
            showReportAlert(data.error || 'Failed to submit report', 'danger');
        }
    } catch (error) {
        console.error('Error submitting report:', error);
        showReportAlert('Failed to submit report', 'danger');
    }
}

function showReportAlert(message, type) {
    const container = document.getElementById('reportAlert');
    if (!message) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        if (type !== 'info') {
            container.innerHTML = '';
        }
    }, 5000);
}

// Setup report form
document.addEventListener('DOMContentLoaded', () => {
    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', handleReportSubmit);
    }

    // Close report modal on outside click
    document.getElementById('reportModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'reportModal') {
            closeReportModal();
        }
    });
});

function openMessageToTutor(tutorId, tutorEmail) {
    // Redirect to messages page with tutor ID in query param
    window.location.href = `/messages.html?userId=${tutorId}`;
}

async function loadTutorRatingBadge(tutorId) {
    try {
        const { data } = await apiCall(`/reviews/stats?userId=${tutorId}`);
        const badge = document.getElementById(`tutorRatingBadge_${tutorId}`);

        if (badge && data.averageRating && data.averageRating > 0) {
            badge.innerHTML = `
                <span style="color: #fbbf24;">★</span>
                <span style="font-weight: 500;">${data.averageRating.toFixed(1)}</span>
                <span style="color: var(--gray-500);">(${data.totalReviews})</span>
            `;
        } else if (badge) {
            badge.innerHTML = `
                <span style="color: var(--gray-400); font-size: 0.75rem;">No ratings</span>
            `;
        }
    } catch (error) {
        console.error('Error loading tutor rating badge:', error);
    }
}
