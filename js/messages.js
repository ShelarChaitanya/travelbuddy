// Messages functionality for Travel Together

let currentUser = null;
let currentConversation = null;
let conversations = [];
let currentMessages = [];
let messagePollingInterval = null;

// Initialize messages page
document.addEventListener('DOMContentLoaded', function() {
    initializeMessages();
});

async function initializeMessages() {
    // Check authentication
    const user = localStorage.getItem('user');
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = JSON.parse(user);
    
    // Load conversations
    await loadConversations();
    
    // Check for compose parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const composeUserId = urlParams.get('compose');
    const messageId = urlParams.get('message');
    
    if (composeUserId) {
        // Start new conversation
        await startNewConversation(composeUserId);
    } else if (messageId) {
        // Open specific message/conversation
        await openMessageById(messageId);
    }
    
    // Start polling for new messages
    startMessagePolling();
}

async function loadConversations() {
    try {
        const response = await fetch('php/messages.php?action=conversations');
        const data = await response.json();
        
        if (data.success) {
            conversations = data.conversations;
            displayConversations(conversations);
        } else {
            console.error('Failed to load conversations:', data.error);
        }
        
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

function displayConversations(conversationList) {
    const container = document.getElementById('conversationsList');
    
    if (!conversationList || conversationList.length === 0) {
        container.innerHTML = `
            <div class="empty-conversations">
                <i class="fas fa-comments"></i>
                <h3>No conversations yet</h3>
                <p>Start a conversation with your travel matches!</p>
                <button class="btn btn-primary" onclick="showComposeModal()">Send First Message</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = conversationList.map(conv => `
        <div class="conversation-item ${conv.unread_count > 0 ? 'unread' : ''}" 
             onclick="openConversation(${conv.other_user_id})" 
             data-user-id="${conv.other_user_id}">
            <div class="conversation-avatar">
                <img src="${conv.other_user_photo || 'https://via.placeholder.com/50'}" alt="${conv.other_user_name}">
            </div>
            <div class="conversation-info">
                <div class="conversation-name">${conv.other_user_name}</div>
                <div class="conversation-preview">${truncateText(conv.last_message || 'No messages yet', 50)}</div>
            </div>
            <div class="conversation-meta">
                <div class="conversation-time">${formatTimeAgo(conv.last_message_time)}</div>
                ${conv.unread_count > 0 ? `<div class="unread-badge">${conv.unread_count}</div>` : ''}
            </div>
        </div>
    `).join('');
}

async function openConversation(userId) {
    try {
        // Update UI
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-user-id="${userId}"]`).classList.add('active');
        
        // Show chat container
        document.getElementById('chatPlaceholder').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'flex';
        
        // Load conversation
        const response = await fetch(`php/messages.php?action=conversation&user=${userId}`);
        const data = await response.json();
        
        if (data.success) {
            currentConversation = {
                userId: userId,
                user: data.other_user
            };
            currentMessages = data.messages;
            
            // Update chat header
            updateChatHeader(data.other_user);
            
            // Display messages
            displayMessages(data.messages);
            
            // Mark messages as read
            await markMessagesAsRead(userId);
            
            // Update conversation list to remove unread badge
            updateConversationReadStatus(userId);
            
        } else {
            showNotification('Failed to load conversation', 'error');
        }
        
    } catch (error) {
        console.error('Error opening conversation:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

function updateChatHeader(user) {
    document.getElementById('chatUserAvatar').src = user.profile_photo || 'https://via.placeholder.com/45';
    document.getElementById('chatUserName').textContent = user.name;
    document.getElementById('chatUserStatus').textContent = user.location || 'Location not specified';
    
    if (user.is_verified) {
        document.getElementById('chatUserStatus').innerHTML += ' <i class="fas fa-check-circle" style="color: var(--success-color);"></i>';
    }
}

function displayMessages(messages) {
    const container = document.getElementById('messagesArea');
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comments"></i>
                <h3>No messages yet</h3>
                <p>Start the conversation by sending a message!</p>
            </div>
        `;
        return;
    }
    
    let messagesHTML = '';
    let lastDate = '';
    
    messages.forEach((message, index) => {
        const messageDate = new Date(message.created_at).toDateString();
        
        // Add date separator if date changed
        if (messageDate !== lastDate) {
            messagesHTML += `
                <div class="message-date-separator">
                    <span>${formatMessageDate(message.created_at)}</span>
                </div>
            `;
            lastDate = messageDate;
        }
        
        const isOwn = message.sender_id == currentUser.id;
        messagesHTML += `
            <div class="message ${isOwn ? 'sent' : 'received'}">
                <div class="message-avatar">
                    <img src="${message.sender_photo || 'https://via.placeholder.com/35'}" alt="${message.sender_name}">
                </div>
                <div class="message-content">
                    <p class="message-text">${escapeHtml(message.message)}</p>
                    <div class="message-time">${formatMessageTime(message.created_at)}</div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = messagesHTML;
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message || !currentConversation) {
        return;
    }
    
    const sendButton = document.getElementById('sendButton');
    sendButton.disabled = true;
    
    try {
        const response = await fetch('php/messages.php?action=send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                receiver_id: currentConversation.userId,
                message: message
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Clear input
            messageInput.value = '';
            autoResizeTextarea();
            
            // Add message to display
            addMessageToDisplay(data.sent_message);
            
            // Update conversation list
            updateConversationLastMessage(currentConversation.userId, message);
            
        } else {
            showNotification(data.error || 'Failed to send message', 'error');
        }
        
    } catch (error) {
        console.error('Send message error:', error);
        showNotification('Connection error. Please try again.', 'error');
    } finally {
        sendButton.disabled = false;
    }
}

function addMessageToDisplay(message) {
    const container = document.getElementById('messagesArea');
    const isOwn = message.sender_id == currentUser.id;
    
    const messageHTML = `
        <div class="message ${isOwn ? 'sent' : 'received'}">
            <div class="message-avatar">
                <img src="${message.sender_photo || 'https://via.placeholder.com/35'}" alt="${message.sender_name}">
            </div>
            <div class="message-content">
                <p class="message-text">${escapeHtml(message.message)}</p>
                <div class="message-time">${formatMessageTime(message.created_at)}</div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', messageHTML);
    container.scrollTop = container.scrollHeight;
    
    // Add to current messages array
    currentMessages.push(message);
}

function handleMessageKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function autoResizeTextarea() {
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function insertEmoji(emoji) {
    const textarea = document.getElementById('messageInput');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    textarea.value = text.substring(0, start) + emoji + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    textarea.focus();
    autoResizeTextarea();
}

// Compose modal functions
function showComposeModal() {
    document.getElementById('composeModal').style.display = 'block';
    document.getElementById('recipientSearch').focus();
}

async function searchUsers() {
    const query = document.getElementById('recipientSearch').value.trim();
    const resultsContainer = document.getElementById('userSearchResults');
    
    if (query.length < 2) {
        resultsContainer.classList.remove('show');
        return;
    }
    
    try {
        const response = await fetch(`php/search_users.php?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success && data.users.length > 0) {
            resultsContainer.innerHTML = data.users.map(user => `
                <div class="search-result-item" onclick="selectRecipient(${user.id}, '${user.name}', '${user.profile_photo || ''}')">
                    <div class="search-result-avatar">
                        <img src="${user.profile_photo || 'https://via.placeholder.com/35'}" alt="${user.name}">
                    </div>
                    <div class="search-result-info">
                        <h4>${user.name}</h4>
                        <p>${user.location || 'Location not specified'}</p>
                    </div>
                </div>
            `).join('');
            resultsContainer.classList.add('show');
        } else {
            resultsContainer.innerHTML = '<div class="search-result-item">No users found</div>';
            resultsContainer.classList.add('show');
        }
        
    } catch (error) {
        console.error('Search users error:', error);
    }
}

function selectRecipient(userId, name, photo) {
    document.getElementById('recipientSearch').value = name;
    document.getElementById('selectedRecipientId').value = userId;
    document.getElementById('userSearchResults').classList.remove('show');
}

// Compose form submission
document.getElementById('composeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const recipientId = document.getElementById('selectedRecipientId').value;
    const subject = document.getElementById('messageSubject').value.trim();
    const message = document.getElementById('composeMessage').value.trim();
    
    if (!recipientId || !message) {
        showNotification('Please select a recipient and enter a message', 'error');
        return;
    }
    
    try {
        const response = await fetch('php/messages.php?action=send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                receiver_id: recipientId,
                message: message,
                subject: subject
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('composeModal');
            showNotification('Message sent successfully!', 'success');
            
            // Reload conversations
            await loadConversations();
            
            // Open the new conversation
            await openConversation(recipientId);
            
        } else {
            showNotification(data.error || 'Failed to send message', 'error');
        }
        
    } catch (error) {
        console.error('Compose message error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
});

async function markMessagesAsRead(userId) {
    try {
        await fetch('php/messages.php?action=mark_read', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                other_user_id: userId
            })
        });
    } catch (error) {
        console.error('Mark as read error:', error);
    }
}

function updateConversationReadStatus(userId) {
    const conversationItem = document.querySelector(`[data-user-id="${userId}"]`);
    if (conversationItem) {
        conversationItem.classList.remove('unread');
        const unreadBadge = conversationItem.querySelector('.unread-badge');
        if (unreadBadge) {
            unreadBadge.remove();
        }
    }
}

function updateConversationLastMessage(userId, message) {
    const conversationItem = document.querySelector(`[data-user-id="${userId}"]`);
    if (conversationItem) {
        const preview = conversationItem.querySelector('.conversation-preview');
        const time = conversationItem.querySelector('.conversation-time');
        
        if (preview) preview.textContent = truncateText(message, 50);
        if (time) time.textContent = 'Just now';
        
        // Move conversation to top
        const container = document.getElementById('conversationsList');
        container.insertBefore(conversationItem, container.firstChild);
    }
}

function filterConversations() {
    const query = document.getElementById('conversationSearch').value.toLowerCase();
    const filteredConversations = conversations.filter(conv => 
        conv.other_user_name.toLowerCase().includes(query)
    );
    displayConversations(filteredConversations);
}

async function startNewConversation(userId) {
    try {
        // Check if conversation already exists
        const existingConv = conversations.find(conv => conv.other_user_id == userId);
        if (existingConv) {
            await openConversation(userId);
            return;
        }
        
        // Get user info
        const response = await fetch(`php/profile.php?user=${userId}`);
        const data = await response.json();
        
        if (data.success) {
            // Create new conversation entry
            const newConv = {
                other_user_id: userId,
                other_user_name: data.user.name,
                other_user_photo: data.user.profile_photo,
                last_message: null,
                last_message_time: new Date().toISOString(),
                unread_count: 0
            };
            
            conversations.unshift(newConv);
            displayConversations(conversations);
            await openConversation(userId);
        }
        
    } catch (error) {
        console.error('Start new conversation error:', error);
    }
}

async function openMessageById(messageId) {
    try {
        const response = await fetch(`php/messages.php?action=get_message&id=${messageId}`);
        const data = await response.json();
        
        if (data.success) {
            const message = data.message;
            const otherUserId = message.sender_id == currentUser.id ? message.receiver_id : message.sender_id;
            await openConversation(otherUserId);
        }
        
    } catch (error) {
        console.error('Open message error:', error);
    }
}

async function viewChatUserProfile() {
    if (!currentConversation) return;
    
    try {
        const response = await fetch(`php/profile.php?user=${currentConversation.userId}`);
        const data = await response.json();
        
        if (data.success) {
            displayUserProfileModal(data.user);
        }
        
    } catch (error) {
        console.error('View profile error:', error);
    }
}

function displayUserProfileModal(user) {
    const modal = document.getElementById('userProfileModal');
    const content = document.getElementById('userProfileContent');
    
    content.innerHTML = `
        <div class="profile-modal-header">
            <div class="profile-avatar-large">
                <img src="${user.profile_photo || 'https://via.placeholder.com/150'}" alt="${user.name}">
            </div>
            <div class="profile-info">
                <h2>${user.name}</h2>
                <p class="profile-location"><i class="fas fa-map-marker-alt"></i> ${user.location || 'Location not specified'}</p>
                <p class="profile-age"><i class="fas fa-calendar"></i> ${user.age || 'Age not specified'} years old</p>
                ${user.is_verified ? '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified</span>' : ''}
            </div>
        </div>
        
        <div class="profile-modal-content">
            <div class="profile-section">
                <h3><i class="fas fa-user"></i> About</h3>
                <p>${user.bio || 'No bio available'}</p>
            </div>
            
            ${user.interests && user.interests.length > 0 ? `
            <div class="profile-section">
                <h3><i class="fas fa-heart"></i> Interests</h3>
                <div class="interests-list">
                    ${user.interests.map(interest => `<span class="interest-tag">${interest}</span>`).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    modal.style.display = 'block';
}

async function blockUser() {
    if (!currentConversation || !confirm('Are you sure you want to block this user?')) {
        return;
    }
    
    try {
        const response = await fetch('php/block_user.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                blocked_user_id: currentConversation.userId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('User blocked successfully', 'success');
            // Remove conversation and go back to placeholder
            conversations = conversations.filter(conv => conv.other_user_id != currentConversation.userId);
            displayConversations(conversations);
            
            document.getElementById('chatContainer').style.display = 'none';
            document.getElementById('chatPlaceholder').style.display = 'flex';
            currentConversation = null;
        } else {
            showNotification(data.error || 'Failed to block user', 'error');
        }
        
    } catch (error) {
        console.error('Block user error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

// Message polling for real-time updates
function startMessagePolling() {
    messagePollingInterval = setInterval(async () => {
        if (currentConversation) {
            await checkForNewMessages();
        }
        await updateConversationsList();
    }, 10000); // Poll every 10 seconds
}

async function checkForNewMessages() {
    if (!currentConversation) return;
    
    try {
        const lastMessageTime = currentMessages.length > 0 ? 
            currentMessages[currentMessages.length - 1].created_at : null;
        
        const response = await fetch(`php/messages.php?action=conversation&user=${currentConversation.userId}&since=${lastMessageTime}`);
        const data = await response.json();
        
        if (data.success && data.messages.length > 0) {
            // Add new messages
            data.messages.forEach(message => {
                if (!currentMessages.find(m => m.id === message.id)) {
                    addMessageToDisplay(message);
                }
            });
        }
        
    } catch (error) {
        console.error('Check for new messages error:', error);
    }
}

async function updateConversationsList() {
    try {
        const response = await fetch('php/messages.php?action=conversations');
        const data = await response.json();
        
        if (data.success) {
            const hasNewMessages = data.conversations.some(conv => {
                const existing = conversations.find(c => c.other_user_id === conv.other_user_id);
                return !existing || existing.last_message_time !== conv.last_message_time;
            });
            
            if (hasNewMessages) {
                conversations = data.conversations;
                displayConversations(conversations);
            }
        }
        
    } catch (error) {
        console.error('Update conversations error:', error);
    }
}

// Utility functions
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function formatMessageDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
}

function formatMessageTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
    }
});
