// Profile Setup JavaScript functionality

let currentStep = 1;
const totalSteps = 4;
let selectedLanguages = [];
let selectedInterests = [];

// Initialize profile setup
document.addEventListener('DOMContentLoaded', function() {
    initializeProfileSetup();
});

function initializeProfileSetup() {
    // Check if user is logged in
    const user = localStorage.getItem('user');
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Initialize form handlers
    initializeLanguageInput();
    initializeInterestSelection();
    initializePhotoUpload();
    initializeFormSubmission();
    
    // Update progress
    updateProgress();
}

function initializeLanguageInput() {
    const languageInput = document.getElementById('languageInput');
    const languageTags = document.getElementById('languageTags');
    
    languageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const language = this.value.trim();
            if (language && !selectedLanguages.includes(language)) {
                addLanguageTag(language);
                this.value = '';
            }
        }
    });
    
    languageInput.addEventListener('blur', function() {
        const language = this.value.trim();
        if (language && !selectedLanguages.includes(language)) {
            addLanguageTag(language);
            this.value = '';
        }
    });
}

function addLanguageTag(language) {
    selectedLanguages.push(language);
    updateLanguageTags();
    updateLanguagesInput();
}

function removeLanguageTag(language) {
    selectedLanguages = selectedLanguages.filter(lang => lang !== language);
    updateLanguageTags();
    updateLanguagesInput();
}

function updateLanguageTags() {
    const languageTags = document.getElementById('languageTags');
    const languageInput = document.getElementById('languageInput');
    
    // Clear existing tags (except input)
    const existingTags = languageTags.querySelectorAll('.language-tag');
    existingTags.forEach(tag => tag.remove());
    
    // Add language tags
    selectedLanguages.forEach(language => {
        const tag = document.createElement('span');
        tag.className = 'language-tag';
        tag.innerHTML = `
            ${language}
            <span class="remove" onclick="removeLanguageTag('${language}')">&times;</span>
        `;
        languageTags.insertBefore(tag, languageInput);
    });
}

function updateLanguagesInput() {
    document.getElementById('languages').value = JSON.stringify(selectedLanguages);
}

function initializeInterestSelection() {
    const interestOptions = document.querySelectorAll('.interest-option');
    
    interestOptions.forEach(option => {
        option.addEventListener('click', function() {
            const checkbox = this.querySelector('input[type="checkbox"]');
            const interest = checkbox.value;
            
            checkbox.checked = !checkbox.checked;
            this.classList.toggle('selected', checkbox.checked);
            
            if (checkbox.checked) {
                if (!selectedInterests.includes(interest)) {
                    selectedInterests.push(interest);
                }
            } else {
                selectedInterests = selectedInterests.filter(i => i !== interest);
            }
        });
    });
}

function initializePhotoUpload() {
    const photoInput = document.getElementById('profilePhoto');
    const photoPreview = document.getElementById('photoPreview');
    const removeBtn = document.getElementById('removePhotoBtn');
    
    photoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                showNotification('File size must be less than 5MB', 'error');
                return;
            }
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
                showNotification('Please select a valid image file', 'error');
                return;
            }
            
            // Preview image
            const reader = new FileReader();
            reader.onload = function(e) {
                photoPreview.innerHTML = `<img src="${e.target.result}" alt="Profile Photo">`;
                photoPreview.classList.add('has-image');
                removeBtn.style.display = 'inline-block';
            };
            reader.readAsDataURL(file);
        }
    });
}

function removePhoto() {
    const photoInput = document.getElementById('profilePhoto');
    const photoPreview = document.getElementById('photoPreview');
    const removeBtn = document.getElementById('removePhotoBtn');
    
    photoInput.value = '';
    photoPreview.innerHTML = `
        <i class="fas fa-user-circle"></i>
        <p>No photo selected</p>
    `;
    photoPreview.classList.remove('has-image');
    removeBtn.style.display = 'none';
}

function changeStep(direction) {
    const newStep = currentStep + direction;
    
    if (newStep < 1 || newStep > totalSteps) {
        return;
    }
    
    // Validate current step before proceeding
    if (direction > 0 && !validateStep(currentStep)) {
        return;
    }
    
    // Hide current step
    document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');
    
    // Show new step
    currentStep = newStep;
    document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');
    
    // Update progress and navigation
    updateProgress();
    updateNavigation();
}

function validateStep(step) {
    switch (step) {
        case 1:
            return validateBasicInfo();
        case 2:
            return validateTravelPreferences();
        case 3:
            return validateInterests();
        case 4:
            return true; // Photo is optional
        default:
            return true;
    }
}

function validateBasicInfo() {
    const requiredFields = ['age', 'gender', 'location', 'bio'];
    let isValid = true;
    
    requiredFields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        if (!field.value.trim()) {
            showError(field, `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`);
            isValid = false;
        } else {
            clearError(field);
        }
    });
    
    // Validate age range
    const age = parseInt(document.getElementById('age').value);
    if (age && (age < 18 || age > 100)) {
        showError(document.getElementById('age'), 'Age must be between 18 and 100');
        isValid = false;
    }
    
    return isValid;
}

function validateTravelPreferences() {
    const requiredFields = ['travel_style', 'group_size_preference'];
    let isValid = true;
    
    requiredFields.forEach(fieldName => {
        const field = document.getElementById(fieldName.replace('_', ''));
        if (!field.value) {
            showError(field, 'This field is required');
            isValid = false;
        } else {
            clearError(field);
        }
    });
    
    // Validate budget range
    const budgetMin = parseFloat(document.getElementById('budgetMin').value) || 0;
    const budgetMax = parseFloat(document.getElementById('budgetMax').value) || 0;
    
    if (budgetMax > 0 && budgetMin > budgetMax) {
        showError(document.getElementById('budgetMax'), 'Maximum budget must be greater than minimum');
        isValid = false;
    }
    
    return isValid;
}

function validateInterests() {
    if (selectedInterests.length === 0) {
        showNotification('Please select at least one interest', 'error');
        return false;
    }
    return true;
}

function updateProgress() {
    const progressFill = document.getElementById('progressFill');
    const currentStepSpan = document.getElementById('currentStep');
    
    const progressPercentage = (currentStep / totalSteps) * 100;
    progressFill.style.width = `${progressPercentage}%`;
    currentStepSpan.textContent = currentStep;
}

function updateNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    // Show/hide previous button
    prevBtn.style.display = currentStep > 1 ? 'inline-block' : 'none';
    
    // Show/hide next/submit buttons
    if (currentStep === totalSteps) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'inline-block';
    } else {
        nextBtn.style.display = 'inline-block';
        submitBtn.style.display = 'none';
    }
}

function initializeFormSubmission() {
    const form = document.getElementById('profileSetupForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validate all steps
        for (let i = 1; i <= totalSteps; i++) {
            if (!validateStep(i)) {
                changeStep(i - currentStep);
                return;
            }
        }
        
        await submitProfile();
    });
}

async function submitProfile() {
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    
    // Show loading state
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Profile...';
    submitBtn.disabled = true;
    
    try {
        // Prepare form data
        const formData = new FormData();
        
        // Basic information
        formData.append('age', document.getElementById('age').value);
        formData.append('gender', document.getElementById('gender').value);
        formData.append('location', document.getElementById('location').value);
        formData.append('phone', document.getElementById('phone').value);
        formData.append('bio', document.getElementById('bio').value);
        
        // Travel preferences
        formData.append('travel_style', document.getElementById('travelStyle').value);
        formData.append('group_size_preference', document.getElementById('groupSize').value);
        formData.append('budget_min', document.getElementById('budgetMin').value || 0);
        formData.append('budget_max', document.getElementById('budgetMax').value || 0);
        formData.append('accommodation_type', document.getElementById('accommodation').value);
        formData.append('languages_spoken', JSON.stringify(selectedLanguages));
        
        // Interests
        formData.append('interests', JSON.stringify(selectedInterests));
        
        // Profile photo
        const photoFile = document.getElementById('profilePhoto').files[0];
        if (photoFile) {
            formData.append('profile_photo', photoFile);
        }
        
        // Submit to server
        const response = await fetch('php/profile.php', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update user data in localStorage
            const currentUser = JSON.parse(localStorage.getItem('user'));
            const updatedUser = { ...currentUser, ...data.user };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            showNotification('Profile completed successfully!', 'success');
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        } else {
            showNotification(data.message || 'Failed to save profile', 'error');
        }
        
    } catch (error) {
        console.error('Profile submission error:', error);
        showNotification('Connection error. Please try again.', 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Utility functions for form validation
function showError(input, message) {
    const formGroup = input.parentElement;
    let errorElement = formGroup.querySelector('.error-message');
    
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.style.color = '#e74c3c';
        errorElement.style.fontSize = '0.9rem';
        errorElement.style.marginTop = '0.5rem';
        formGroup.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    input.style.borderColor = '#e74c3c';
}

function clearError(input) {
    const formGroup = input.parentElement;
    const errorElement = formGroup.querySelector('.error-message');
    
    if (errorElement) {
        errorElement.remove();
    }
    
    input.style.borderColor = '#ddd';
}

// Handle browser back/forward buttons
window.addEventListener('popstate', function(e) {
    // Prevent user from navigating away during profile setup
    if (confirm('Are you sure you want to leave? Your progress will be lost.')) {
        window.location.href = 'index.html';
    } else {
        history.pushState(null, null, window.location.pathname);
    }
});

// Prevent accidental page refresh
window.addEventListener('beforeunload', function(e) {
    e.preventDefault();
    e.returnValue = 'Are you sure you want to leave? Your progress will be lost.';
});

// Initialize navigation prevention
history.pushState(null, null, window.location.pathname);
