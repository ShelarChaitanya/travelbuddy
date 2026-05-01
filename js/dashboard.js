// Dashboard JavaScript functionality

// Global variables
let currentUser = null;
let dashboardData = {
    matches: [],
    trips: [],
    messages: [],
    stats: {
        matchCount: 0,
        messageCount: 0,
        tripCount: 0
    }
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function initializeDashboard() {
    // Check authentication
    const user = localStorage.getItem('user');
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = JSON.parse(user);
    
    // Update user info in UI
    updateUserInfo();
    
    // Load dashboard data
    await loadDashboardData();
    
    // Hide loading overlay
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function updateUserInfo() {
    document.getElementById('userName').textContent = currentUser.name;
    
    // Update avatar if available
    const userAvatar = document.getElementById('userAvatar');
    if (currentUser.profile_photo) {
        userAvatar.src = currentUser.profile_photo;
    }
}

async function loadDashboardData() {
    try {
        // Load all dashboard data in parallel
        const [matchesData, tripsData, messagesData, statsData] = await Promise.all([
            fetchRecentMatches(),
            fetchUpcomingTrips(),
            fetchRecentMessages(),
            fetchDashboardStats()
        ]);
        
        // Update dashboard sections
        updateStats(statsData);
        updateRecentMatches(matchesData);
        updateUpcomingTrips(tripsData);
        updateRecentMessages(messagesData);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'error');
    }
}

async function fetchRecentMatches() {
    try {
        const response = await fetch('php/matches.php?action=recent&limit=6');
        const data = await response.json();
        return data.success ? data.matches : [];
    } catch (error) {
        console.error('Error fetching matches:', error);
        return [];
    }
}

async function fetchUpcomingTrips() {
    try {
        const response = await fetch('php/trips.php?action=upcoming&limit=5');
        const data = await response.json();
        return data.success ? data.trips : [];
    } catch (error) {
        console.error('Error fetching trips:', error);
        return [];
    }
}

async function fetchRecentMessages() {
    try {
        const response = await fetch('php/messages.php?action=recent&limit=5');
        const data = await response.json();
        return data.success ? data.messages : [];
    } catch (error) {
        console.error('Error fetching messages:', error);
        return [];
    }
}

async function fetchDashboardStats() {
    try {
        const response = await fetch('php/dashboard.php?action=stats');
        const data = await response.json();
        return data.success ? data.stats : {
            matchCount: 0,
            messageCount: 0,
            tripCount: 0
        };
    } catch (error) {
        console.error('Error fetching stats:', error);
        return {
            matchCount: 0,
            messageCount: 0,
            tripCount: 0
        };
    }
}

function updateStats(stats) {
    document.getElementById('matchCount').textContent = stats.matchCount || 0;
    document.getElementById('messageCount').textContent = stats.messageCount || 0;
    document.getElementById('tripCount').textContent = stats.tripCount || 0;
    
    // Update unread message badge
    const unreadBadge = document.getElementById('unreadCount');
    if (stats.messageCount > 0) {
        unreadBadge.textContent = stats.messageCount;
        unreadBadge.classList.add('show');
    } else {
        unreadBadge.classList.remove('show');
    }
}

function updateRecentMatches(matches) {
    const container = document.getElementById('recentMatches');
    
    if (!matches || matches.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No matches yet</h3>
                <p>Complete your profile to start finding travel buddies!</p>
                <button class="btn btn-primary" onclick="window.location.href='profile.html'">Complete Profile</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = matches.map(match => `
        <div class="match-card">
            <div class="match-header">
                <div class="match-avatar">
                    <img src="${match.profile_photo || 'https://via.placeholder.com/60'}" alt="${match.name}">
                </div>
                <div class="compatibility-score">${match.compatibility_score}% Match</div>
            </div>
            <div class="match-content">
                <h3>${match.name}</h3>
                <p>${match.bio || 'No bio available'}</p>
                <div class="match-tags">
                    ${(match.interests || []).slice(0, 3).map(interest => 
                        `<span class="tag">${interest}</span>`
                    ).join('')}
                </div>
                <div class="match-actions">
                    <button class="btn btn-outline btn-small" onclick="viewProfile(${match.id})">View Profile</button>
                    <button class="btn btn-primary btn-small" onclick="sendMessage(${match.id})">Message</button>
                </div>
            </div>
        </div>
    `).join('');
}

function updateUpcomingTrips(trips) {
    const container = document.getElementById('upcomingTrips');
    
    if (!trips || trips.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-map-marker-alt"></i>
                <h3>No upcoming trips</h3>
                <p>Create your first trip and start inviting travel buddies!</p>
                <button class="btn btn-primary" onclick="window.location.href='trips.html#create'">Create Trip</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = trips.map(trip => `
        <div class="trip-card" onclick="viewTrip(${trip.id})">
            <div class="trip-icon">
                <i class="fas fa-${getTripIcon(trip.trip_type)}"></i>
            </div>
            <div class="trip-info">
                <h3>${trip.title}</h3>
                <div class="trip-meta">
                    <span><i class="fas fa-map-marker-alt"></i> ${trip.destination}</span>
                    <span><i class="fas fa-calendar"></i> ${formatDate(trip.start_date)}</span>
                    <span><i class="fas fa-users"></i> ${trip.current_participants}/${trip.max_participants}</span>
                </div>
                <span class="trip-status status-${trip.status}">${trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}</span>
            </div>
        </div>
    `).join('');
}

function updateRecentMessages(messages) {
    const container = document.getElementById('recentMessages');
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-envelope"></i>
                <h3>No messages yet</h3>
                <p>Start connecting with travel buddies to begin conversations!</p>
                <button class="btn btn-primary" onclick="window.location.href='search.html'">Find Buddies</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = messages.map(message => `
        <div class="message-card ${!message.is_read ? 'unread' : ''}" onclick="openMessage(${message.id})">
            <div class="message-avatar">
                <img src="${message.sender_photo || 'https://via.placeholder.com/50'}" alt="${message.sender_name}">
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${message.sender_name}</span>
                    <span class="message-time">${formatTimeAgo(message.created_at)}</span>
                </div>
                <div class="message-preview">${truncateText(message.message, 60)}</div>
            </div>
        </div>
    `).join('');
}

// User menu toggle
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('show');
}

// Close user menu when clicking outside
document.addEventListener('click', function(event) {
    const userMenu = document.querySelector('.user-menu');
    if (!userMenu.contains(event.target)) {
        document.getElementById('userDropdown').classList.remove('show');
    }
});

// Action handlers
function viewProfile(userId) {
    window.location.href = `profile.html?user=${userId}`;
}

function sendMessage(userId) {
    window.location.href = `messages.html?compose=${userId}`;
}

function viewTrip(tripId) {
    window.location.href = `trips.html?trip=${tripId}`;
}

function openMessage(messageId) {
    window.location.href = `messages.html?message=${messageId}`;
}

// Utility functions
function getTripIcon(tripType) {
    const icons = {
        'adventure': 'mountain',
        'relaxation': 'spa',
        'cultural': 'landmark',
        'business': 'briefcase',
        'educational': 'graduation-cap',
        'other': 'map'
    };
    return icons[tripType] || 'map';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

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
    } else {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days}d ago`;
    }
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}

// Refresh dashboard data
function refreshDashboard() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
    loadDashboardData().then(() => {
        document.getElementById('loadingOverlay').classList.add('hidden');
        showNotification('Dashboard refreshed', 'success');
    });
}

// Auto-refresh dashboard every 5 minutes
setInterval(refreshDashboard, 5 * 60 * 1000);
