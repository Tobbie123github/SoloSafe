// ========================
// SOLOSAFE - MAIN SCRIPT
// Complete rewrite with unified authentication
// ========================

const API_BASE_URL = 'https://solosafe-backend.onrender.com/api';

// ========================
// TOAST NOTIFICATION SYSTEM
// ========================

function showToast(message, type = 'info') {
    const colors = {
        success: 'linear-gradient(to right, #007153ff, #01ab6aff)',
        error: 'linear-gradient(to right, #ff5f6d, #ff71a7ff)',
        warning: 'linear-gradient(to right, #f7971e, #ffd200)',
        info: 'linear-gradient(to right, #667eea, #764ba2)'
    };

    Toastify({
        text: message,
        duration: 5000,
        close: true,
        gravity: "top",
        position: "right",
        stopOnFocus: true,
        style: {
            background: colors[type] || colors.info,
        },
    }).showToast();
}

// ========================
// DARK MODE
// ========================

function initializeDarkMode() {
    const darkMode = localStorage.getItem('solosafe_dark_mode') === 'true';
    if (darkMode) {
        document.body.classList.add('dark-mode');
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('solosafe_dark_mode', isDark);
    showToast(`${isDark ? 'Dark' : 'Light'} mode enabled`, 'info');
}

// ========================
// AUTHENTICATION & USER MANAGEMENT
// ========================

/**
 * Get authentication token from storage
 * Checks both regular login and Google OAuth tokens
 */
function getAuthToken() {
    // First check for regular login token
    const userStr = localStorage.getItem('solosafe_user');
    if (userStr && userStr !== 'undefined' && userStr !== 'null') {
        try {
            const userData = JSON.parse(userStr);
            if (userData.token) {
                return userData.token;
            }
        } catch (err) {
            console.error('Error parsing user token:', err);
        }
    }
    
    // Fallback to Google token
    const googleToken = localStorage.getItem('solosafe_token');
    return googleToken || null;
}

/**
 * Get current user with unified structure
 * Returns: { name, email, username, token, profilePicture, ... }
 */
function getCurrentUser() {
    const userStr = localStorage.getItem('solosafe_user');
    
    if (!userStr || userStr === 'undefined' || userStr === 'null') {
        return null;
    }
    
    try {
        const data = JSON.parse(userStr);
        
        // Handle different response structures
        // Regular login: { token, user: { name, email, ... } }
        // Google login: { token, name, email, ... }
        
        if (data.user) {
            // Regular login structure - flatten it
            return {
                ...data.user,
                token: data.token
            };
        } else {
            // Google login structure (already flat)
            return data;
        }
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('solosafe_user');
        return null;
    }
}

/**
 * Fetch user profile from backend and store it
 */
async function fetchUserProfile() {
    try {
        const token = getAuthToken();
        
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }

        const userData = await response.json();
        
        // Store in unified format
        const userToStore = {
            ...userData,
            token: token
        };
        
        localStorage.setItem('solosafe_user', JSON.stringify(userToStore));
        
        return userToStore;
    } catch (err) {
        console.error('Failed to fetch user profile:', err);
        throw err;
    }
}

/**
 * Handle Google OAuth callback
 * Called automatically on dashboard load if ?token param exists
 */
async function handleGoogleCallback() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (!token) {
        return false; // Not a Google callback
    }
    
    try {
        console.log('🔐 Processing Google OAuth token...');
        
        // Store the token temporarily
        localStorage.setItem('solosafe_token', token);
        
        // Fetch full user profile from backend
        const user = await fetchUserProfile();
        
        console.log('✅ User authenticated:', user.email);
        
        // Clean up temporary token (now stored in solosafe_user)
        localStorage.removeItem('solosafe_token');
        
        // Clean URL WITHOUT reloading (this prevents the loop!)
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        
        // Show success message
        showToast(`Welcome ${user.name || user.email}!`, 'success');
        
        return true;
    } catch (err) {
        console.error('Google sign-in error:', err);
        showToast('Authentication failed. Please try again.', 'error');
        
        // Clean up failed attempt
        localStorage.removeItem('solosafe_token');
        localStorage.removeItem('solosafe_user');
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 20000);
        return false;
    }
}

/**
 * Update user profile in storage
 */
function updateUserProfile(updates) {
    const user = getCurrentUser();
    if (!user) return null;
    
    const updatedUser = { ...user, ...updates };
    localStorage.setItem('solosafe_user', JSON.stringify(updatedUser));
    
    return updatedUser;
}

/**
 * Get personalized welcome message
 */
function getWelcomeMessage() {
    const user = getCurrentUser();
    if (!user) return 'Welcome!';
    
    const displayName = user.name || user.username || user.email.split('@')[0];
    return `Welcome back, ${displayName}!`;
}

/**
 * Logout user and clear all data
 */
function logout() {
    const token = getAuthToken();
    
    // Call backend logout endpoint
    if (token) {
        fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).catch(err => console.error('Logout error:', err));
    }
    
    // Clear all auth data
    localStorage.removeItem('solosafe_user');
    localStorage.removeItem('solosafe_token');
    localStorage.removeItem('solosafe_trips');
    localStorage.removeItem('solosafe_temp_signup');
    
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// ========================
// AUTHENTICATED FETCH
// ========================

/**
 * Make authenticated API requests
 * Automatically includes Bearer token and handles 401 errors
 */
async function authenticatedFetch(url, options = {}) {
    const token = getAuthToken();
    
    if (!token) {
        showToast('Please login first', 'warning');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
        return null;
    }
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, mergedOptions);
        
        // Handle session expiration (401 Unauthorized)
        if (response.status === 401) {
            showToast('Session expired. Please login again.', 'warning');
            localStorage.removeItem('solosafe_user');
            localStorage.removeItem('solosafe_token');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        showToast('Network error. Please try again.', 'error');
        throw error;
    }
}

// ========================
// TRIP MANAGEMENT
// ========================

/**
 * Create a new trip
 */
async function createTrip(tripData) {
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/trips`, {
            method: 'POST',
            body: JSON.stringify(tripData)
        });
        
        if (!response) return null;
        
        const data = await response.json();
        
        if (response.ok && data.trip) {
            showToast('Trip created successfully!', 'success');
            return data.trip;
        } else {
            throw new Error(data.message || 'Failed to create trip');
        }
    } catch (err) {
        console.error('Create trip error:', err);
        showToast(err.message || 'Failed to create trip', 'error');
        return null;
    }
}

/**
 * Get all trips for current user
 */
async function getAllTrips() {
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/trips`);
        
        if (!response) return [];
        
        const trips = await response.json();
        
        if (response.ok && Array.isArray(trips)) {
            // Cache trips in localStorage
            localStorage.setItem('solosafe_trips', JSON.stringify(trips));
            return trips;
        }
        
        return [];
    } catch (err) {
        console.error('Get trips error:', err);
        return [];
    }
}

/**
 * Get current active trip
 */
async function getCurrentTrip() {
    try {
        const trips = await getAllTrips();
        const now = new Date();
        
        // Find active trip (started, not ended, not completed)
        return trips.find(t => {
            const start = new Date(t.startDate);
            const end = new Date(t.endDate);
            return start <= now && now <= end && t.status !== 'Completed';
        }) || null;
    } catch (err) {
        console.error('Get current trip error:', err);
        return null;
    }
}

/**
 * Update trip details
 */
async function updateTrip(tripId, updates) {
    try {
        const response = await authenticatedFetch(
            `${API_BASE_URL}/trips/${tripId}`,
            {
                method: 'PUT',
                body: JSON.stringify(updates)
            }
        );
        
        if (!response) return null;
        
        const data = await response.json();
        
        if (response.ok && data.trip) {
            return data.trip;
        }
        
        return null;
    } catch (err) {
        console.error('Update trip error:', err);
        return null;
    }
}

/**
 * End a trip
 */
async function endTrip(tripId) {
    try {
        const response = await authenticatedFetch(
            `${API_BASE_URL}/trips/${tripId}/end`,
            {
                method: 'PUT'
            }
        );
        
        if (!response) return null;
        
        const data = await response.json();
        
        if (response.ok && data.trip) {
            showToast('Trip completed successfully', 'success');
            sendNotification('Trip Completed', 'Your trip has ended safely');
            return data.trip;
        }
        
        return null;
    } catch (err) {
        console.error('End trip error:', err);
        showToast('Failed to end trip', 'error');
        return null;
    }
}

/**
 * Check in during a trip
 */
async function checkIn(tripId) {
    try {
        const location = await getCurrentLocation().catch(() => null);
        
        const response = await authenticatedFetch(
            `${API_BASE_URL}/trips/${tripId}/safe`,
            {
                method: 'PUT',
                body: JSON.stringify({
                    location: location ? {
                        lat: location.lat,
                        lng: location.lng
                    } : null,
                    timestamp: new Date().toISOString()
                })
            }
        );
        
        if (!response) return;
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Check-in successful! ✅', 'success');
            sendNotification('Check-in Confirmed', 'You have successfully checked in');
        } else {
            throw new Error(data.message || 'Check-in failed');
        }
    } catch (err) {
        console.error('Check-in error:', err);
        showToast('Check-in failed. Please try again.', 'error');
    }
}

/**
 * Trigger SOS alert
 */
async function triggerSOS(tripId) {
    try {
        const location = await getCurrentLocation().catch(() => null);
        
        const response = await authenticatedFetch(
            `${API_BASE_URL}/alerts/sos`,
            {
                method: 'POST',
                body: JSON.stringify({
                    tripId,
                    location: location ? {
                        lat: location.lat,
                        lng: location.lng
                    } : null,
                    timestamp: new Date().toISOString()
                })
            }
        );
        
        if (!response) return;
        
        if (response.ok) {
            showToast('🚨 SOS alert sent to all emergency contacts', 'warning');
            sendNotification('SOS Alert Triggered', 'Emergency contacts have been notified');
        }
    } catch (err) {
        console.error('SOS error:', err);
        showToast('Failed to send SOS alert', 'error');
    }
}

// ========================
// EMERGENCY CONTACTS
// ========================

/**
 * Add emergency contact to trip
 */
async function addContact(tripId, contact) {
    try {
        const response = await authenticatedFetch(
            `${API_BASE_URL}/trips/${tripId}/contacts`,
            {
                method: 'PUT',
                body: JSON.stringify(contact)
            }
        );
        
        if (!response) return null;
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Emergency contact added', 'success');
            sendNotification('Contact Added', `${contact.name} added as emergency contact`);
            return data.trip;
        }
        
        return null;
    } catch (err) {
        console.error('Add contact error:', err);
        showToast('Failed to add contact', 'error');
        return null;
    }
}

/**
 * Remove emergency contact from trip
 */
async function removeContact(tripId, contactId) {
    try {
        const response = await authenticatedFetch(
            `${API_BASE_URL}/trips/${tripId}/contacts/${contactId}`,
            {
                method: 'DELETE'
            }
        );
        
        if (!response) return;
        
        if (response.ok) {
            showToast('Emergency contact removed', 'info');
        }
    } catch (err) {
        console.error('Remove contact error:', err);
        showToast('Failed to remove contact', 'error');
    }
}

// ========================
// GEOLOCATION API
// ========================

let watchId = null;
let currentLocation = null;

/**
 * Get current GPS location
 */
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            position => {
                currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    timestamp: Date.now()
                };
                resolve(currentLocation);
            },
            error => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

/**
 * Start continuous location tracking
 */
function startLocationTracking() {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported by your browser', 'error');
        return;
    }
    
    watchId = navigator.geolocation.watchPosition(
        position => {
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: Date.now()
            };
            
            console.log('Location updated:', currentLocation);
        },
        error => {
            console.error('Location error:', error);
            showToast('Failed to get location', 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
    
    showToast('Location tracking enabled', 'success');
}

/**
 * Stop location tracking
 */
function stopLocationTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        showToast('Location tracking disabled', 'info');
    }
}

// ========================
// NOTIFICATION API
// ========================

/**
 * Request permission for browser notifications
 */
function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
    }
    
    if (Notification.permission === 'granted') {
        showToast('Notifications already enabled', 'info');
        return;
    }
    
    if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showToast('Notifications enabled successfully', 'success');
                sendNotification('Welcome to SoloSafe!', 'You will receive important updates about your trips');
            }
        });
    }
}

/**
 * Send browser notification
 */
function sendNotification(title, body, options = {}) {
    if (!('Notification' in window)) {
        console.log('Notifications not supported');
        return;
    }
    
    if (Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            ...options
        });
        
        notification.onclick = function() {
            window.focus();
            this.close();
        };
        
        setTimeout(() => notification.close(), 5000);
    }
}

/**
 * Show notification permission prompt
 */
function showNotificationPrompt() {
    if (Notification.permission === 'default') {
        const promptDiv = document.createElement('div');
        promptDiv.className = 'alert alert-info position-fixed top-0 start-50 translate-middle-x mt-3';
        promptDiv.style.zIndex = '9999';
        promptDiv.innerHTML = `
            <div class="d-flex align-items-center justify-content-between">
                <span>Enable notifications to stay updated about your trips?</span>
                <div>
                    <button class="btn btn-sm btn-primary me-2" onclick="acceptNotifications()">Yes</button>
                    <button class="btn btn-sm btn-secondary" onclick="dismissNotificationPrompt()">No</button>
                </div>
            </div>
        `;
        promptDiv.id = 'notificationPrompt';
        document.body.appendChild(promptDiv);
    }
}

function acceptNotifications() {
    requestNotificationPermission();
    dismissNotificationPrompt();
}

function dismissNotificationPrompt() {
    const prompt = document.getElementById('notificationPrompt');
    if (prompt) prompt.remove();
}

// ========================
// ITINERARY SHARING
// ========================

/**
 * Generate and copy shareable trip link
 */
function generateShareLink(tripId) {
    const shareLink = `${window.location.origin}/shared-trip.html?id=${tripId}`;
    
    navigator.clipboard.writeText(shareLink).then(() => {
        showToast('Share link copied to clipboard! 📋', 'success');
        sendNotification('Link Shared', 'Trip itinerary link has been copied');
    }).catch(() => {
        // Fallback if clipboard API fails
        showToast('Link: ' + shareLink, 'info');
    });
    
    return shareLink;
}

// ========================
// PROFILE MANAGEMENT
// ========================

/**
 * Upload profile picture
 */
function uploadProfilePicture(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('Please select an image file'));
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            reject(new Error('Image size must be less than 5MB'));
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const dataURL = e.target.result;
            updateUserProfile({ profilePicture: dataURL });
            showToast('Profile picture updated!', 'success');
            resolve(dataURL);
        };
        
        reader.onerror = function() {
            reject(new Error('Failed to read file'));
        };
        
        reader.readAsDataURL(file);
    });
}

/**
 * Change user password
 */
async function changePassword(oldPassword, newPassword) {
    try {
        const response = await authenticatedFetch(
            `${API_BASE_URL}/auth/change-password`,
            {
                method: 'PUT',
                body: JSON.stringify({ oldPassword, newPassword })
            }
        );
        
        if (!response) return false;
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Password changed successfully!', 'success');
            return true;
        } else {
            showToast(data.message || 'Failed to change password', 'error');
            return false;
        }
    } catch (err) {
        console.error('Change password error:', err);
        showToast('Failed to change password', 'error');
        return false;
    }
}

/**
 * Download user data as JSON
 */
function downloadUserData() {
    const user = getCurrentUser();
    const trips = JSON.parse(localStorage.getItem('solosafe_trips') || '[]');
    
    const userData = {
        user: {
            name: user.name,
            email: user.email,
            username: user.username
        },
        trips,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(userData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `SoloSafe_UserData_${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showToast('User data downloaded!', 'success');
}

// ========================
// SIDEBAR FUNCTIONS
// ========================

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (sidebar && mainContent) {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    }
}

function showSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar) sidebar.classList.add('show');
    if (overlay) overlay.classList.add('show');
}

function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar) sidebar.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
}

function toggleProfileDropdown() {
    const dropdown = document.querySelector('.profile-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const profileDropdown = document.querySelector('.profile-dropdown');
    const userProfile = document.querySelector('.user-profile');
    
    if (profileDropdown && userProfile) {
        if (!userProfile.contains(e.target) && !profileDropdown.contains(e.target)) {
            profileDropdown.classList.remove('show');
        }
    }
});

// ========================
// INITIALIZATION
// ========================

document.addEventListener('DOMContentLoaded', async () => { // Added async
    initializeDarkMode();
    
    // 1. Process Google Login FIRST
    const isGoogleLogin = await handleGoogleCallback();
    
    // 2. Define protected pages
    const protectedPages = ['dashboard', 'create-trip', 'active-trip', 'emergency-contacts', 'settings'];
    const currentPage = window.location.pathname;
    const isProtectedPage = protectedPages.some(page => currentPage.includes(page));
    
    // 3. Only redirect if it's a protected page AND we don't have a user now
    if (isProtectedPage) {
        const user = getCurrentUser();
        if (!user) {
            showToast('Please login first', 'warning');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
            return; // Stop further execution
        }
        
        // 4. Update UI with user info if on dashboard
        updateUIWithUserData(user);
    }
});

// Helper to update the dashboard UI elements
function updateUIWithUserData(user) {
    const welcomeMsg = document.getElementById('welcomeMessage');
    const headerName = document.getElementById('headerUserName');
    const headerEmail = document.getElementById('headerUserEmail');
    const headerPic = document.getElementById('headerProfilePic');

    if (welcomeMsg) welcomeMsg.innerText = getWelcomeMessage();
    if (headerName) headerName.innerText = user.name || user.username || 'User';
    if (headerEmail) headerEmail.innerText = user.email;
    if (headerPic && user.profilePicture) headerPic.src = user.profilePicture;
}

// ========================
// EXPORT GLOBAL FUNCTIONS
// ========================

// Authentication
window.getAuthToken = getAuthToken;
window.getCurrentUser = getCurrentUser;
window.fetchUserProfile = fetchUserProfile;
window.handleGoogleCallback = handleGoogleCallback;
window.updateUserProfile = updateUserProfile;
window.getWelcomeMessage = getWelcomeMessage;
window.logout = logout;

// API
window.authenticatedFetch = authenticatedFetch;

// Trips
window.createTrip = createTrip;
window.getAllTrips = getAllTrips;
window.getCurrentTrip = getCurrentTrip;
window.updateTrip = updateTrip;
window.endTrip = endTrip;
window.checkIn = checkIn;
window.triggerSOS = triggerSOS;

// Contacts
window.addContact = addContact;
window.removeContact = removeContact;

// Location
window.getCurrentLocation = getCurrentLocation;
window.startLocationTracking = startLocationTracking;
window.stopLocationTracking = stopLocationTracking;

// Notifications
window.requestNotificationPermission = requestNotificationPermission;
window.sendNotification = sendNotification;
window.showNotificationPrompt = showNotificationPrompt;
window.acceptNotifications = acceptNotifications;
window.dismissNotificationPrompt = dismissNotificationPrompt;

// Sharing
window.generateShareLink = generateShareLink;

// Profile
window.uploadProfilePicture = uploadProfilePicture;
window.changePassword = changePassword;
window.downloadUserData = downloadUserData;

// UI
window.toggleDarkMode = toggleDarkMode;
window.toggleSidebar = toggleSidebar;
window.showSidebar = showSidebar;
window.closeSidebar = closeSidebar;
window.toggleProfileDropdown = toggleProfileDropdown;
window.showToast = showToast;