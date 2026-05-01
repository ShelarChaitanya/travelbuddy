// Search functionality for Travel Together

let currentSearchResults = [];
let currentOffset = 0;
let currentSwipeIndex = 0;
let swipeCards = [];
let searchFilters = {};
let currentMode = 'discover';

// Initialize search page
document.addEventListener('DOMContentLoaded', function() {
    initializeSearch();
});

async function initializeSearch() {
    // Check authentication
    const user = localStorage.getItem('user');
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDateFilter').min = today;
    document.getElementById('endDateFilter').min = today;

    // Load initial results
    await searchBuddies();
}

async function searchBuddies() {
    showLoading();
    
    try {
        // Get filter values
        searchFilters = {
            destination: document.getElementById('destinationFilter').value.trim(),
            start_date: document.getElementById('startDateFilter').value,
            end_date: document.getElementById('endDateFilter').value,
            max_budget: document.getElementById('budgetFilter').value,
            travel_style: document.getElementById('travelStyleFilter').value,
            age_range: document.getElementById('ageRangeFilter').value,
            limit: 20,
            offset: 0
        };

        // Reset pagination
        currentOffset = 0;
        
        const response = await fetch('php/matches.php?action=find&' + new URLSearchParams(searchFilters));
        const data = await response.json();
        
        if (data.success) {
            currentSearchResults = data.matches;
            displaySearchResults(data.matches);
            
            // Show load more button if there are more results
            const loadMoreBtn = document.getElementById('loadMoreBtn');
            if (data.matches.length >= 20) {
                loadMoreBtn.style.display = 'block';
            } else {
                loadMoreBtn.style.display = 'none';
            }
        } else {
            showNotification(data.error || 'Failed to search for buddies', 'error');
        }
        
    } catch (error) {
        console.error('Search error:', error);
        showNotification('Connection error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function displaySearchResults(matches) {
    const container = document.getElementById('searchResults');
    
    if (!matches || matches.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No matches found</h3>
                <p>Try adjusting your search filters to find more travel buddies.</p>
                <button class="btn btn-primary" onclick="clearFilters()">Clear Filters</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = matches.map(match => `
        <div class="match-card" data-user-id="${match.id}">
            <div class="match-header">
                <div class="match-avatar">
                    <img src="${match.profile_photo || 'https://via.placeholder.com/60'}" alt="${match.name}">
                </div>
                <div class="compatibility-score">${match.compatibility_score}% Match</div>
            </div>
            <div class="match-content">
                <h3>${match.name}</h3>
                <p class="match-location"><i class="fas fa-map-marker-alt"></i> ${match.location || 'Location not specified'}</p>
                <p class="match-bio">${truncateText(match.bio || 'No bio available', 100)}</p>
                
                <div class="match-details">
                    <div class="detail-item">
                        <i class="fas fa-calendar"></i>
                        <span>Age ${match.age || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-suitcase"></i>
                        <span>${match.travel_style || 'Any style'}</span>
                    </div>
                    ${match.budget_min && match.budget_max ? `
                    <div class="detail-item">
                        <i class="fas fa-dollar-sign"></i>
                        <span>$${match.budget_min}-${match.budget_max}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="match-tags">
                    ${(match.interests || []).slice(0, 4).map(interest => 
                        `<span class="tag">${interest}</span>`
                    ).join('')}
                    ${match.interests && match.interests.length > 4 ? 
                        `<span class="tag more">+${match.interests.length - 4} more</span>` : ''}
                </div>
                
                <div class="match-factors">
                    <h4>Why you match:</h4>
                    <div class="factors-list">
                        ${generateMatchFactors(match.match_factors)}
                    </div>
                </div>
                
                <div class="match-actions">
                    <button class="btn btn-outline btn-small" onclick="viewUserProfile(${match.id})">
                        <i class="fas fa-user"></i> View Profile
                    </button>
                    <button class="btn btn-outline btn-small" onclick="passUser(${match.id})">
                        <i class="fas fa-times"></i> Pass
                    </button>
                    <button class="btn btn-primary btn-small" onclick="likeUser(${match.id})">
                        <i class="fas fa-heart"></i> Like
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function generateMatchFactors(factors) {
    if (!factors) return '<p>No specific factors available</p>';
    
    let factorsList = [];
    
    if (factors.common_interests && factors.common_interests.interests.length > 0) {
        factorsList.push(`<span class="factor"><i class="fas fa-heart"></i> ${factors.common_interests.interests.length} shared interests</span>`);
    }
    
    if (factors.common_destinations && factors.common_destinations.destinations.length > 0) {
        factorsList.push(`<span class="factor"><i class="fas fa-map-marker-alt"></i> ${factors.common_destinations.destinations.length} common destinations</span>`);
    }
    
    if (factors.travel_style && factors.travel_style.score > 0) {
        factorsList.push(`<span class="factor"><i class="fas fa-suitcase"></i> Compatible travel style</span>`);
    }
    
    if (factors.budget_compatibility && factors.budget_compatibility.score > 0) {
        factorsList.push(`<span class="factor"><i class="fas fa-dollar-sign"></i> Budget compatibility</span>`);
    }
    
    if (factors.common_languages && factors.common_languages.languages.length > 0) {
        factorsList.push(`<span class="factor"><i class="fas fa-language"></i> ${factors.common_languages.languages.length} shared languages</span>`);
    }
    
    return factorsList.length > 0 ? factorsList.join('') : '<p>General compatibility</p>';
}

async function loadMoreResults() {
    currentOffset += 20;
    searchFilters.offset = currentOffset;
    
    try {
        const response = await fetch('php/matches.php?action=find&' + new URLSearchParams(searchFilters));
        const data = await response.json();
        
        if (data.success && data.matches.length > 0) {
            currentSearchResults = [...currentSearchResults, ...data.matches];
            
            // Append new results
            const container = document.getElementById('searchResults');
            const newResults = data.matches.map(match => `
                <div class="match-card" data-user-id="${match.id}">
                    <!-- Same card HTML as above -->
                </div>
            `).join('');
            
            container.insertAdjacentHTML('beforeend', newResults);
            
            // Hide load more button if no more results
            if (data.matches.length < 20) {
                document.getElementById('loadMoreBtn').style.display = 'none';
            }
        } else {
            document.getElementById('loadMoreBtn').style.display = 'none';
        }
        
    } catch (error) {
        console.error('Load more error:', error);
        showNotification('Failed to load more results', 'error');
    }
}

function clearFilters() {
    document.getElementById('destinationFilter').value = '';
    document.getElementById('startDateFilter').value = '';
    document.getElementById('endDateFilter').value = '';
    document.getElementById('budgetFilter').value = '';
    document.getElementById('travelStyleFilter').value = '';
    document.getElementById('ageRangeFilter').value = '';
    
    searchBuddies();
}

function sortResults() {
    const sortBy = document.getElementById('sortBy').value;
    
    let sortedResults = [...currentSearchResults];
    
    switch (sortBy) {
        case 'compatibility':
            sortedResults.sort((a, b) => b.compatibility_score - a.compatibility_score);
            break;
        case 'recent':
            sortedResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'location':
            sortedResults.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
            break;
    }
    
    displaySearchResults(sortedResults);
}

// Mode switching
function switchMode(mode) {
    currentMode = mode;
    
    // Update tab styles
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
    
    // Show/hide sections
    if (mode === 'discover') {
        document.getElementById('discoverMode').style.display = 'block';
        document.getElementById('swipeMode').style.display = 'none';
    } else {
        document.getElementById('discoverMode').style.display = 'none';
        document.getElementById('swipeMode').style.display = 'block';
        initializeSwipeMode();
    }
}

async function initializeSwipeMode() {
    if (swipeCards.length === 0) {
        // Load cards for swiping
        try {
            const response = await fetch('php/matches.php?action=find&limit=10');
            const data = await response.json();
            
            if (data.success) {
                swipeCards = data.matches;
                currentSwipeIndex = 0;
                displaySwipeCard();
            }
        } catch (error) {
            console.error('Failed to load swipe cards:', error);
        }
    } else {
        displaySwipeCard();
    }
}

function displaySwipeCard() {
    const container = document.getElementById('swipeCards');
    
    if (currentSwipeIndex >= swipeCards.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-heart-broken"></i>
                <h3>No more profiles</h3>
                <p>You've seen all available profiles. Check back later for new members!</p>
                <button class="btn btn-primary" onclick="switchMode('discover')">Browse Profiles</button>
            </div>
        `;
        return;
    }
    
    const card = swipeCards[currentSwipeIndex];
    
    container.innerHTML = `
        <div class="swipe-card" data-user-id="${card.id}">
            <div class="card-image">
                <img src="${card.profile_photo || 'https://via.placeholder.com/400x300'}" alt="${card.name}">
                <div class="compatibility-badge">${card.compatibility_score}% Match</div>
            </div>
            <div class="card-content">
                <h2>${card.name}, ${card.age || 'N/A'}</h2>
                <p class="location"><i class="fas fa-map-marker-alt"></i> ${card.location || 'Location not specified'}</p>
                <p class="bio">${card.bio || 'No bio available'}</p>
                
                <div class="interests">
                    ${(card.interests || []).slice(0, 6).map(interest => 
                        `<span class="interest-tag">${interest}</span>`
                    ).join('')}
                </div>
                
                <div class="travel-info">
                    <div class="info-item">
                        <i class="fas fa-suitcase"></i>
                        <span>${card.travel_style || 'Any style'}</span>
                    </div>
                    ${card.budget_min && card.budget_max ? `
                    <div class="info-item">
                        <i class="fas fa-dollar-sign"></i>
                        <span>$${card.budget_min}-${card.budget_max}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

async function likeUser(userId) {
    try {
        const response = await fetch('php/matches.php?action=like', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                target_user_id: userId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.is_mutual) {
                // Show match modal
                const user = currentSearchResults.find(u => u.id === userId) || swipeCards[currentSwipeIndex];
                showMatchModal(user);
            } else {
                showNotification('Like sent successfully!', 'success');
            }
            
            // Remove from current results
            removeUserFromResults(userId);
        } else {
            showNotification(data.error || 'Failed to like user', 'error');
        }
        
    } catch (error) {
        console.error('Like user error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

async function passUser(userId) {
    try {
        const response = await fetch('php/matches.php?action=pass', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                target_user_id: userId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            removeUserFromResults(userId);
        } else {
            showNotification(data.error || 'Failed to pass user', 'error');
        }
        
    } catch (error) {
        console.error('Pass user error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

function removeUserFromResults(userId) {
    // Remove from search results
    currentSearchResults = currentSearchResults.filter(user => user.id !== userId);
    
    // Remove card from DOM
    const card = document.querySelector(`[data-user-id="${userId}"]`);
    if (card) {
        card.remove();
    }
    
    // Handle swipe mode
    if (currentMode === 'swipe') {
        currentSwipeIndex++;
        displaySwipeCard();
    }
}

// Swipe mode functions
function likeCurrentCard() {
    if (currentSwipeIndex < swipeCards.length) {
        const currentCard = swipeCards[currentSwipeIndex];
        likeUser(currentCard.id);
    }
}

function passCurrentCard() {
    if (currentSwipeIndex < swipeCards.length) {
        const currentCard = swipeCards[currentSwipeIndex];
        passUser(currentCard.id);
    }
}

async function viewUserProfile(userId) {
    try {
        const response = await fetch(`php/profile.php?user=${userId}`);
        const data = await response.json();
        
        if (data.success) {
            displayProfileModal(data.user);
        } else {
            showNotification('Failed to load profile', 'error');
        }
        
    } catch (error) {
        console.error('View profile error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

function displayProfileModal(user) {
    const modal = document.getElementById('profileModal');
    const content = document.getElementById('profileModalContent');
    
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
            
            <div class="profile-section">
                <h3><i class="fas fa-suitcase"></i> Travel Preferences</h3>
                <div class="travel-prefs">
                    <div class="pref-item">
                        <strong>Travel Style:</strong> ${user.travel_style || 'Not specified'}
                    </div>
                    <div class="pref-item">
                        <strong>Group Size:</strong> ${user.group_size_preference || 'Any'} people
                    </div>
                    ${user.budget_min && user.budget_max ? `
                    <div class="pref-item">
                        <strong>Budget Range:</strong> $${user.budget_min} - $${user.budget_max}
                    </div>
                    ` : ''}
                </div>
            </div>
            
            ${user.languages_spoken && user.languages_spoken.length > 0 ? `
            <div class="profile-section">
                <h3><i class="fas fa-language"></i> Languages</h3>
                <div class="languages-list">
                    ${user.languages_spoken.map(lang => `<span class="language-badge">${lang}</span>`).join('')}
                </div>
            </div>
            ` : ''}
            
            <div class="profile-actions">
                <button class="btn btn-outline" onclick="passUser(${user.id}); closeModal('profileModal')">
                    <i class="fas fa-times"></i> Pass
                </button>
                <button class="btn btn-primary" onclick="likeUser(${user.id}); closeModal('profileModal')">
                    <i class="fas fa-heart"></i> Like
                </button>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

function showMatchModal(user) {
    document.getElementById('matchedUserName').textContent = user.name;
    document.getElementById('matchModal').style.display = 'block';
    
    // Store matched user ID for conversation
    window.matchedUserId = user.id;
}

function startConversation() {
    closeModal('matchModal');
    window.location.href = `messages.html?compose=${window.matchedUserId}`;
}

// Utility functions
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}
