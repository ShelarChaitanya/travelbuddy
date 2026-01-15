// Trips functionality for Travel Together

let currentUser = null;
let myTrips = [];
let discoveredTrips = [];
let currentTripFilter = 'all';
let selectedTripForJoin = null;

// Initialize trips page
document.addEventListener('DOMContentLoaded', function() {
    initializeTrips();
});

async function initializeTrips() {
    // Check authentication
    const user = localStorage.getItem('user');
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = JSON.parse(user);
    
    // Set minimum dates to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tripStartDate').min = today;
    document.getElementById('tripEndDate').min = today;
    document.getElementById('startDateSearch').min = today;
    document.getElementById('endDateSearch').min = today;
    
    // Load trips
    await loadMyTrips();
    
    // Check for hash to create trip
    if (window.location.hash === '#create') {
        showCreateTripModal();
    }
}

async function loadMyTrips() {
    try {
        const response = await fetch('php/trips.php?action=my_trips');
        const data = await response.json();
        
        if (data.success) {
            myTrips = data.trips;
            displayMyTrips(myTrips);
        } else {
            console.error('Failed to load trips:', data.error);
        }
        
    } catch (error) {
        console.error('Error loading trips:', error);
    }
}

function displayMyTrips(trips) {
    const container = document.getElementById('myTripsGrid');
    
    if (!trips || trips.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-map-marked-alt"></i>
                <h3>No trips yet</h3>
                <p>Create your first trip and start inviting travel buddies!</p>
                <button class="btn btn-primary" onclick="showCreateTripModal()">Create Your First Trip</button>
            </div>
        `;
        return;
    }
    
    // Filter trips based on current filter
    let filteredTrips = trips;
    if (currentTripFilter !== 'all') {
        filteredTrips = trips.filter(trip => trip.status === currentTripFilter);
    }
    
    container.innerHTML = filteredTrips.map(trip => `
        <div class="trip-card" onclick="viewTripDetails(${trip.id})">
            <div class="trip-header">
                <div class="trip-type-icon">
                    <i class="fas fa-${getTripTypeIcon(trip.trip_type)}"></i>
                </div>
                <div class="trip-status status-${trip.status}">${trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}</div>
            </div>
            
            <div class="trip-content">
                <h3>${trip.title}</h3>
                <p class="trip-destination"><i class="fas fa-map-marker-alt"></i> ${trip.destination}</p>
                <p class="trip-description">${truncateText(trip.description || 'No description', 100)}</p>
                
                <div class="trip-details">
                    <div class="detail-item">
                        <i class="fas fa-calendar"></i>
                        <span>${formatDateRange(trip.start_date, trip.end_date)}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-users"></i>
                        <span>${trip.current_participants}/${trip.max_participants} people</span>
                    </div>
                    ${trip.budget_per_person ? `
                    <div class="detail-item">
                        <i class="fas fa-dollar-sign"></i>
                        <span>$${trip.budget_per_person} per person</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="trip-role">
                    ${trip.role === 'creator' ? 
                        '<span class="role-badge creator"><i class="fas fa-crown"></i> Trip Creator</span>' : 
                        '<span class="role-badge participant"><i class="fas fa-user"></i> Participant</span>'
                    }
                </div>
            </div>
            
            <div class="trip-actions">
                ${trip.role === 'creator' ? `
                    <button class="btn btn-outline btn-small" onclick="event.stopPropagation(); editTrip(${trip.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                ` : ''}
                <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); viewTripDetails(${trip.id})">
                    <i class="fas fa-eye"></i> View Details
                </button>
            </div>
        </div>
    `).join('');
}

async function loadDiscoveredTrips(filters = {}) {
    try {
        const params = new URLSearchParams(filters);
        const response = await fetch(`php/trips.php?action=search&${params}`);
        const data = await response.json();
        
        if (data.success) {
            discoveredTrips = data.trips;
            displayDiscoveredTrips(discoveredTrips);
        } else {
            console.error('Failed to load discovered trips:', data.error);
        }
        
    } catch (error) {
        console.error('Error loading discovered trips:', error);
    }
}

function displayDiscoveredTrips(trips) {
    const container = document.getElementById('discoverTripsGrid');
    
    if (!trips || trips.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No trips found</h3>
                <p>Try adjusting your search filters to find more trips.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = trips.map(trip => `
        <div class="trip-card discover-card" onclick="viewTripDetails(${trip.id})">
            <div class="trip-header">
                <div class="trip-type-icon">
                    <i class="fas fa-${getTripTypeIcon(trip.trip_type)}"></i>
                </div>
                <div class="trip-status status-${trip.status}">${trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}</div>
            </div>
            
            <div class="trip-content">
                <h3>${trip.title}</h3>
                <p class="trip-destination"><i class="fas fa-map-marker-alt"></i> ${trip.destination}</p>
                <p class="trip-description">${truncateText(trip.description || 'No description', 100)}</p>
                
                <div class="trip-details">
                    <div class="detail-item">
                        <i class="fas fa-calendar"></i>
                        <span>${formatDateRange(trip.start_date, trip.end_date)}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-users"></i>
                        <span>${trip.current_participants}/${trip.max_participants} people</span>
                    </div>
                    ${trip.budget_per_person ? `
                    <div class="detail-item">
                        <i class="fas fa-dollar-sign"></i>
                        <span>$${trip.budget_per_person} per person</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="trip-creator">
                    <img src="${trip.creator_photo || 'https://via.placeholder.com/30'}" alt="${trip.creator_name}" class="creator-avatar">
                    <span>by ${trip.creator_name}</span>
                </div>
            </div>
            
            <div class="trip-actions">
                <button class="btn btn-outline btn-small" onclick="event.stopPropagation(); viewCreatorProfile(${trip.creator_id})">
                    <i class="fas fa-user"></i> Creator
                </button>
                <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); showJoinTripModal(${trip.id})">
                    <i class="fas fa-user-plus"></i> Join Trip
                </button>
            </div>
        </div>
    `).join('');
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    // Load content if needed
    if (tabName === 'discover-trips' && discoveredTrips.length === 0) {
        loadDiscoveredTrips();
    }
}

// Filter trips
function filterTrips(status) {
    currentTripFilter = status;
    
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-status="${status}"]`).classList.add('active');
    
    // Display filtered trips
    displayMyTrips(myTrips);
}

// Search trips
function searchTrips() {
    const filters = {
        destination: document.getElementById('destinationSearch').value.trim(),
        start_date: document.getElementById('startDateSearch').value,
        end_date: document.getElementById('endDateSearch').value,
        trip_type: document.getElementById('tripTypeSearch').value
    };
    
    // Remove empty filters
    Object.keys(filters).forEach(key => {
        if (!filters[key]) {
            delete filters[key];
        }
    });
    
    loadDiscoveredTrips(filters);
}

// Create trip modal
function showCreateTripModal() {
    document.getElementById('createTripModal').style.display = 'block';
    
    // Set default dates
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    document.getElementById('tripStartDate').value = nextWeek.toISOString().split('T')[0];
    
    const twoWeeksLater = new Date(nextWeek);
    twoWeeksLater.setDate(nextWeek.getDate() + 7);
    document.getElementById('tripEndDate').value = twoWeeksLater.toISOString().split('T')[0];
}

// Create trip form submission
document.getElementById('createTripForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const tripData = Object.fromEntries(formData.entries());
    
    // Validate dates
    const startDate = new Date(tripData.start_date);
    const endDate = new Date(tripData.end_date);
    const today = new Date();
    
    if (startDate <= today) {
        showNotification('Start date must be in the future', 'error');
        return;
    }
    
    if (endDate <= startDate) {
        showNotification('End date must be after start date', 'error');
        return;
    }
    
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating Trip...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('php/trips.php?action=create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tripData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('createTripModal');
            showNotification('Trip created successfully!', 'success');
            
            // Reload trips
            await loadMyTrips();
            
            // Reset form
            this.reset();
            
        } else {
            showNotification(data.error || 'Failed to create trip', 'error');
        }
        
    } catch (error) {
        console.error('Create trip error:', error);
        showNotification('Connection error. Please try again.', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

async function viewTripDetails(tripId) {
    try {
        const response = await fetch(`php/trips.php?action=get&id=${tripId}`);
        const data = await response.json();
        
        if (data.success) {
            displayTripDetailsModal(data.trip);
        } else {
            showNotification('Failed to load trip details', 'error');
        }
        
    } catch (error) {
        console.error('View trip details error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

function displayTripDetailsModal(trip) {
    const modal = document.getElementById('tripDetailsModal');
    const content = document.getElementById('tripDetailsContent');
    
    const isCreator = trip.is_creator;
    const userParticipation = trip.user_participation_status;
    
    content.innerHTML = `
        <div class="trip-details-header">
            <div class="trip-title-section">
                <h2>${trip.title}</h2>
                <div class="trip-meta">
                    <span class="trip-status status-${trip.status}">${trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}</span>
                    <span class="trip-type"><i class="fas fa-${getTripTypeIcon(trip.trip_type)}"></i> ${trip.trip_type.charAt(0).toUpperCase() + trip.trip_type.slice(1)}</span>
                </div>
            </div>
            
            <div class="trip-actions-header">
                ${isCreator ? `
                    <button class="btn btn-outline" onclick="editTrip(${trip.id})">
                        <i class="fas fa-edit"></i> Edit Trip
                    </button>
                ` : userParticipation === null ? `
                    <button class="btn btn-primary" onclick="showJoinTripModal(${trip.id})">
                        <i class="fas fa-user-plus"></i> Join Trip
                    </button>
                ` : userParticipation === 'requested' ? `
                    <button class="btn btn-outline" disabled>
                        <i class="fas fa-clock"></i> Request Pending
                    </button>
                ` : userParticipation === 'accepted' ? `
                    <button class="btn btn-outline" onclick="leaveTrip(${trip.id})">
                        <i class="fas fa-sign-out-alt"></i> Leave Trip
                    </button>
                ` : ''}
            </div>
        </div>
        
        <div class="trip-details-content">
            <div class="trip-info-grid">
                <div class="info-section">
                    <h3><i class="fas fa-map-marker-alt"></i> Destination</h3>
                    <p>${trip.destination}</p>
                </div>
                
                <div class="info-section">
                    <h3><i class="fas fa-calendar"></i> Dates</h3>
                    <p>${formatDateRange(trip.start_date, trip.end_date)}</p>
                </div>
                
                <div class="info-section">
                    <h3><i class="fas fa-users"></i> Participants</h3>
                    <p>${trip.current_participants} of ${trip.max_participants} people</p>
                </div>
                
                ${trip.budget_per_person ? `
                <div class="info-section">
                    <h3><i class="fas fa-dollar-sign"></i> Budget</h3>
                    <p>$${trip.budget_per_person} per person</p>
                </div>
                ` : ''}
                
                <div class="info-section">
                    <h3><i class="fas fa-signal"></i> Difficulty</h3>
                    <p>${trip.difficulty_level.charAt(0).toUpperCase() + trip.difficulty_level.slice(1)}</p>
                </div>
                
                <div class="info-section">
                    <h3><i class="fas fa-user"></i> Created by</h3>
                    <div class="creator-info">
                        <img src="${trip.creator_photo || 'https://via.placeholder.com/40'}" alt="${trip.creator_name}" class="creator-avatar">
                        <span>${trip.creator_name}</span>
                    </div>
                </div>
            </div>
            
            ${trip.description ? `
            <div class="description-section">
                <h3><i class="fas fa-info-circle"></i> Description</h3>
                <p>${trip.description}</p>
            </div>
            ` : ''}
            
            ${trip.requirements ? `
            <div class="requirements-section">
                <h3><i class="fas fa-list-check"></i> Requirements</h3>
                <p>${trip.requirements}</p>
            </div>
            ` : ''}
            
            <div class="participants-section">
                <h3><i class="fas fa-users"></i> Participants (${trip.participants.length})</h3>
                <div class="participants-list">
                    ${trip.participants.map(participant => `
                        <div class="participant-card">
                            <img src="${participant.profile_photo || 'https://via.placeholder.com/50'}" alt="${participant.name}" class="participant-avatar">
                            <div class="participant-info">
                                <h4>${participant.name}</h4>
                                <p>${participant.location || 'Location not specified'}</p>
                                <span class="participant-status status-${participant.status}">${participant.status}</span>
                            </div>
                            ${isCreator && participant.status === 'requested' ? `
                            <div class="participant-actions">
                                <button class="btn btn-outline btn-small" onclick="respondToJoinRequest(${trip.id}, ${participant.id}, 'declined')">
                                    <i class="fas fa-times"></i> Decline
                                </button>
                                <button class="btn btn-primary btn-small" onclick="respondToJoinRequest(${trip.id}, ${participant.id}, 'accepted')">
                                    <i class="fas fa-check"></i> Accept
                                </button>
                            </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

function showJoinTripModal(tripId) {
    selectedTripForJoin = tripId;
    document.getElementById('joinTripModal').style.display = 'block';
    document.getElementById('joinMessage').value = '';
}

async function submitJoinRequest() {
    if (!selectedTripForJoin) return;
    
    const message = document.getElementById('joinMessage').value.trim();
    
    try {
        const response = await fetch('php/trips.php?action=join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                trip_id: selectedTripForJoin,
                message: message
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('joinTripModal');
            showNotification('Join request sent successfully!', 'success');
            
            // Reload trips if on discover tab
            if (document.getElementById('discover-trips').classList.contains('active')) {
                searchTrips();
            }
            
        } else {
            showNotification(data.error || 'Failed to send join request', 'error');
        }
        
    } catch (error) {
        console.error('Join trip error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

async function leaveTrip(tripId) {
    if (!confirm('Are you sure you want to leave this trip?')) {
        return;
    }
    
    try {
        const response = await fetch('php/trips.php?action=leave', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                trip_id: tripId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('tripDetailsModal');
            showNotification('Left trip successfully', 'success');
            
            // Reload trips
            await loadMyTrips();
            
        } else {
            showNotification(data.error || 'Failed to leave trip', 'error');
        }
        
    } catch (error) {
        console.error('Leave trip error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

// Utility functions
function getTripTypeIcon(type) {
    const icons = {
        'adventure': 'mountain',
        'relaxation': 'spa',
        'cultural': 'landmark',
        'business': 'briefcase',
        'educational': 'graduation-cap',
        'other': 'map'
    };
    return icons[type] || 'map';
}

function formatDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startFormatted = start.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
    
    const endFormatted = end.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    
    return `${startFormatted} - ${endFormatted}`;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}

// Date validation for form
document.getElementById('tripStartDate').addEventListener('change', function() {
    const startDate = new Date(this.value);
    const endDateInput = document.getElementById('tripEndDate');
    
    // Set minimum end date to start date + 1 day
    const minEndDate = new Date(startDate);
    minEndDate.setDate(startDate.getDate() + 1);
    endDateInput.min = minEndDate.toISOString().split('T')[0];
    
    // Update end date if it's before start date
    if (endDateInput.value && new Date(endDateInput.value) <= startDate) {
        endDateInput.value = minEndDate.toISOString().split('T')[0];
    }
});

// Search date validation
document.getElementById('startDateSearch').addEventListener('change', function() {
    const startDate = new Date(this.value);
    const endDateInput = document.getElementById('endDateSearch');
    
    if (startDate) {
        endDateInput.min = this.value;
        
        if (endDateInput.value && new Date(endDateInput.value) < startDate) {
            endDateInput.value = '';
        }
    }
});
