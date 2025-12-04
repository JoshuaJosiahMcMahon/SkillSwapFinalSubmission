let currentConversationUserId = null;
let conversations = [];
let pollInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await requireAuth();
    if (!auth) return;

    await loadConversations();
    setupMessageForm();
    setupUserSearch();

    const urlParams = new URLSearchParams(window.location.search);
    const targetUserId = urlParams.get('userId');

    if (targetUserId) {
        const targetUserIdInt = parseInt(targetUserId);

        const targetUser = conversations.find(c => c.userId === targetUserIdInt);

        if (targetUser) {

            const email = targetUser.user ? targetUser.user.email : `User #${targetUserIdInt}`;
            openConversation(targetUserIdInt, email);
        } else {

            try {

                let foundName = `User #${targetUserIdInt}`;

                try {

                } catch (e) { }

                openConversation(targetUserIdInt, foundName);
            } catch (e) {
                console.error('Error handling target user:', e);
                openConversation(targetUserIdInt, `User #${targetUserIdInt}`);
            }
        }
    }

    pollInterval = setInterval(async () => {
        if (currentConversationUserId) {

            await loadMessages(currentConversationUserId, true);
        }
        await updateUnreadCount();
        await loadConversations(true);
    }, 3000);

    await updateUnreadCount();
});

function setupUserSearch() {
    const searchInput = document.getElementById('userSearchInput');
    const resultsContainer = document.getElementById('userSearchResults');

    if (!searchInput || !resultsContainer) return;

    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        clearTimeout(debounceTimer);

        if (query.length < 2) {
            resultsContainer.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {

                const { data: searchData } = await apiCall(`/search/tutors?major=${encodeURIComponent(query)}`);

                if (!searchData) return;

                const { data } = await apiCall(`/search/tutors?major=${encodeURIComponent(query)}`);

                const users = (data && data.tutors) ? data.tutors : [];

                if (users.length === 0) {
                    resultsContainer.innerHTML = '<div style="padding: 0.5rem; color: var(--gray-500); text-align: center;">No users found</div>';
                } else {
                    resultsContainer.innerHTML = users.map(user => `
                        <div class="conversation-item" style="border-radius: 0;" onclick="openConversation(${user.id}, '${(user.fullName || user.email).replace(/'/g, "\\'")}')">
                            <strong>${user.fullName || user.email}</strong>
                            <div style="font-size: 0.75rem; color: var(--gray-600);">${user.blockName || ''}</div>
                        </div>
                    `).join('');
                }
                resultsContainer.style.display = 'block';
            } catch (error) {
                console.error('Error searching users:', error);
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.style.display = 'none';
        }
    });
}

async function loadConversations(silent = false) {
    try {
        const result = await apiCall('/messages/conversations');

        const listEl = document.getElementById('conversationsList');
        if (!listEl) return;

        if (result.error || !result.data) {
            console.error('Error loading conversations:', result.error);
            if (!silent) {
                listEl.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">Unable to load conversations</p>';
            }
            return;
        }

        const data = result.data;
        conversations = data.conversations || [];

        if (conversations.length === 0) {
            listEl.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">No conversations yet</p>';
            return;
        }

        listEl.innerHTML = conversations.map(conv => {
            const isActive = currentConversationUserId === conv.userId;
            const unreadBadge = conv.unreadCount > 0 ?
                `<span class="unread-badge">${conv.unreadCount}</span>` : '';

            let dateString = '-';
            try {
                if (conv.lastMessage) {
                    dateString = new Date(conv.lastMessage).toLocaleString();
                }
            } catch (e) {}

            const user = conv.user || {};

            let displayName = `User #${conv.userId}`;
            if (user.firstName && user.lastName) {
                displayName = `${user.firstName} ${user.lastName}`;
            } else if (user.username) {
                displayName = user.username;
            } else if (user.email) {
                displayName = user.email;
            }

            const displayNameSafe = displayName.replace(/'/g, "&apos;").replace(/"/g, "&quot;");

            return `
                <div class="conversation-item ${isActive ? 'active' : ''}"
                     onclick="openConversation(${conv.userId}, '${displayNameSafe}')"
                     data-user-id="${conv.userId}">
                    <div class="conversation-header">
                        <strong>${displayName}</strong>
                        ${unreadBadge}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--gray-600);">
                        ${dateString}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading conversations:', error);
        const listEl = document.getElementById('conversationsList');
        if (listEl && !silent) {
            listEl.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">Unable to load conversations</p>';
        }
    }
}

async function openConversation(userId, displayName) {
    try {
        currentConversationUserId = userId;

        const titleEl = document.getElementById('conversationTitle');
        const emptyStateEl = document.getElementById('emptyState');
        const containerEl = document.getElementById('messagesContainer');
        const formEl = document.getElementById('messageForm');
        const idInputEl = document.getElementById('currentUserId');
        const listEl = document.getElementById('messagesList');

        // Ensure elements exist
        if (!titleEl || !emptyStateEl || !containerEl || !formEl || !idInputEl || !listEl) {
            console.error('Missing required DOM elements for messaging');
            return;
        }

        // Update UI
        titleEl.textContent = displayName || `User #${userId}`;
        emptyStateEl.style.display = 'none';
        containerEl.style.display = 'flex';
        containerEl.style.flexDirection = 'column';
        idInputEl.value = userId;
        formEl.style.display = 'flex';

        // Clear previous messages or show loading
        listEl.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">Loading messages...</p>';

        // Load messages
        await loadMessages(userId);

        // Update list active state
        loadConversations(true);
    } catch (error) {
        console.error('Error opening conversation:', error);
        alert('Failed to open conversation. Please try again.');
    }
}

async function loadMessages(userId, silent = false) {
    try {
        const result = await apiCall(`/messages/conversation?userId=${userId}`);

        const messagesList = document.getElementById('messagesList');
        if (!messagesList) return;

        if (result.error || !result.data) {
            console.error('Error loading messages:', result.error);
            if (!silent) {
                messagesList.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">Unable to load messages. You can still send a message below.</p>';
            }
            // Still show the input form
            const messageForm = document.getElementById('messageForm');
            if (messageForm) {
                messageForm.style.display = 'flex';
            }
            return;
        }

        const data = result.data;
        if (data.error) {
            if (!silent) {
                messagesList.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">Unable to load messages. You can still send a message below.</p>';
            }
            // Still show the input form
            const messageForm = document.getElementById('messageForm');
            if (messageForm) {
                messageForm.style.display = 'flex';
            }
            return;
        }

        const messages = data.messages || [];

        if (messages.length === 0) {
            messagesList.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">No messages yet. Start the conversation by typing a message below!</p>';
            // Ensure form is visible
            const messageForm = document.getElementById('messageForm');
            if (messageForm) {
                messageForm.style.display = 'flex';
            }
            return;
        }

        // Get current user ID from cookie
        const currentUserId = parseInt(getCookie('sessionId'));

        messagesList.innerHTML = messages.map(msg => {
            const isSent = msg.senderId === currentUserId;
            const bubbleClass = isSent ? 'message-sent' : 'message-received';
            const time = new Date(msg.createdAt).toLocaleString();

            return `
                <div class="message-bubble ${bubbleClass}">
                    <div>${msg.content.replace(/\n/g, '<br>')}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        }).join('');

        // Scroll to bottom only if we weren't already scrolled up significantly

        const wasAtBottom = messagesList.scrollHeight - messagesList.scrollTop <= messagesList.clientHeight + 100;

        if (!silent || wasAtBottom) {
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    } catch (error) {
        if (!silent) console.error('Error loading messages:', error);
        const messagesList = document.getElementById('messagesList');
        if (messagesList && !silent) {
            messagesList.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 2rem;">Error loading messages</p>';
        }
    }
}

function setupMessageForm() {
    const form = document.getElementById('messageForm');
    if (form) {
        form.addEventListener('submit', handleSendMessage);
    }
}

async function handleSendMessage(e) {
    e.preventDefault();
    const receiverId = document.getElementById('currentUserId').value;
    const content = document.getElementById('messageInput').value.trim();

    if (!receiverId || !content) {
        showNotification('Please enter a message', 'warning');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
        const { data } = await apiCall('/messages', {
            method: 'POST',
            body: {
                receiverId: parseInt(receiverId),
                content
            }
        });

        if (data.success) {
            document.getElementById('messageInput').value = '';
            await loadMessages(parseInt(receiverId));
            await loadConversations();

            const messagesList = document.getElementById('messagesList');
            if (messagesList) {
                messagesList.scrollTop = messagesList.scrollHeight;
            }
        } else {
            showNotification(data.error || 'Failed to send message', 'error');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Failed to send message. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function updateUnreadCount() {
    try {
        const { data } = await apiCall('/messages/unread-count');
        const badge = document.getElementById('unreadBadge');
        if (data.count && data.count > 0) {
            badge.textContent = data.count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Error updating unread count:', error);
    }
}

window.addEventListener('beforeunload', () => {
    if (pollInterval) {
        clearInterval(pollInterval);
    }
});
