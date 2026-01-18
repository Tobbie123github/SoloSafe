// SoloSafe - Complete JavaScript Functionality (Session-Based Auth)

// ========================
// UTILITY FUNCTIONS
// ========================

// Toast Notification System

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

// function showToast(message, type = 'info') {
//     const container = document.querySelector('.toast-container') || createToastContainer();
    
//     const toast = document.createElement('div');
//     toast.className = `toast ${type}`;
    
//     const icon = getToastIcon(type);
    
//     toast.innerHTML = `
//         <i class="fas ${icon}"></i>
//         <span>${message}</span>
//         <div class="toast-progress"></div>
//     `;
    
//     container.appendChild(toast);
    
//     setTimeout(() => {
//         toast.style.animation = 'slideOut 0.3s ease-out';
//         setTimeout(() => toast.remove(), 300);
//     }, 5000);
// }

// function createToastContainer() {
//     const container = document.createElement('div');
//     container.className = 'toast-container';
//     document.body.appendChild(container);
//     return container;
// }

// function getToastIcon(type) {
//     const icons = {
//         success: 'fa-check-circle',
//         error: 'fa-exclamation-circle',
//         info: 'fa-info-circle',
//         warning: 'fa-exclamation-triangle'
//     };
//     return icons[type] || icons.info;
// }

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
// AUTHENTICATED FETCH (Session-Based)
// ========================

async function authenticatedFetch(url, options = {}) {
    const defaultOptions = {
        // ✅ CRITICAL: Include session cookies
        headers: {
            'Content-Type': 'application/json',
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
// USER MANAGEMENT
// ========================

function getCurrentUser() {
    const userStr = localStorage.getItem('solosafe_user');
    
    if (!userStr || userStr === 'undefined' || userStr === 'null') {
        return null;
    }
    
    try {
        return JSON.parse(userStr);
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('solosafe_user');
        return null;
    }
}

function updateUserProfile(updates) {
    const user = getCurrentUser();
    if (!user) return null;
    
    const updatedUser = { ...user, ...updates };
    localStorage.setItem('solosafe_user', JSON.stringify(updatedUser));
    
    return updatedUser;
}

function getWelcomeMessage() {
    // const user = getCurrentUser();
    // if (!user) return '';

    const data = JSON.parse(localStorage.getItem("solosafe_user"));

    
    
    return `Welcome back, ${data.user.name || data.requestNotificationPermission.email}!`;
}

function logout() {
    // Call backend logout endpoint
    fetch('https://solosafe-backend.onrender.com/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
    }).catch(err => console.error('Logout error:', err));
    
    // Clear local storage
    localStorage.removeItem('solosafe_user');
    localStorage.removeItem("solosafe_trips");
    localStorage.removeItem("solosafe_temp_signup");
    
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// ========================
// TRIP MANAGEMENT
// ========================

async function createTrip(tripData) {
    try {
        const response = await authenticatedFetch('https://solosafe-backend.onrender.com/api/trips', {
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

async function getCurrentTrip() {
    try {
        const response = await authenticatedFetch('https://solosafe-backend.onrender.com/api/trips');
        
        if (!response) return null;
        
        const data = await response.json();
        
        if (response.ok && data.trips) {
            // Find active trip
            return data.trips.find(t => t.status === 'active') || null;
        }
        
        return null;
    } catch (err) {
        console.error('Get trips error:', err);
        return null;
    }
}

async function updateTrip(tripId, updates) {
    try {
        const response = await authenticatedFetch(
            `https://solosafe-backend.onrender.com/api/trips/${tripId}`,
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

async function endTrip(tripId) {
    try {
        const response = await authenticatedFetch(
            `https://solosafe-backend.onrender.com/api/trips/${tripId}/end`,
            {
                method: 'PUT'
            }
        );
        
        if (!response) return null;
        
        const data = await response.json();
        
        if (response.ok && data.trip) {
            showToast('Trip completed successfully', 'success');
            sendNotification('Trip Completed', `Your trip has ended`);
            return data.trip;
        }
        
        return null;
    } catch (err) {
        console.error('End trip error:', err);
        showToast('Failed to end trip', 'error');
        return null;
    }
}

async function checkIn(tripId) {
    try {
        const location = await getCurrentLocation().catch(() => null);
        
        const response = await authenticatedFetch(
            `https://solosafe-backend.onrender.com/api/trips/${tripId}/safe`,
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

async function triggerSOS(tripId) {
    try {
        const location = await getCurrentLocation().catch(() => null);
        
        const response = await authenticatedFetch(
            'https://solosafe-backend.onrender.com/api/alerts/sos',
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

async function addContact(tripId, contact) {
    try {
        const response = await authenticatedFetch(
            `https://solosafe-backend.onrender.com/api/trips/${tripId}/contacts`,
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

async function removeContact(tripId, contactId) {
    try {
        const response = await authenticatedFetch(
            `https://solosafe-backend.onrender.com/api/trips/${tripId}/contacts/${contactId}`,
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
            }
        );
    });
}

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

function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
    }
    
    if (Notification.permission === 'granted') {
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

function generateShareLink(tripId) {
    // Generate public share link
    const shareLink = `${window.location.origin}/shared-trip.html?id=${tripId}`;
    
    // Copy to clipboard
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

function uploadProfilePicture(file) {
    return new Promise((resolve, reject) => {
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

async function changePassword(oldPassword, newPassword) {
    try {
        const response = await authenticatedFetch(
            'https://solosafe-backend.onrender.com/api/auth/change-password',
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

function downloadUserData() {
    const user = getCurrentUser();
    
    const userData = {
        user,
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

document.addEventListener('DOMContentLoaded', () => {
    initializeDarkMode();
    
    // Check if user is logged in for protected pages
    const protectedPages = ['dashboard', 'create-trip', 'active-trip', 'emergency-contacts', 'settings'];
    const currentPage = window.location.pathname;
    
    const isProtectedPage = protectedPages.some(page => currentPage.includes(page));
    
    if (isProtectedPage) {
        const user = getCurrentUser();
        if (!user) {
            showToast('Please login first', 'warning');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        }
    }
});

// ========================
// GLOBAL FUNCTIONS (for HTML onclick handlers)
// ========================

window.toggleDarkMode = toggleDarkMode;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.showSidebar = showSidebar;
window.closeSidebar = closeSidebar;
window.toggleProfileDropdown = toggleProfileDropdown;
window.showToast = showToast;
window.getCurrentUser = getCurrentUser;
window.uploadProfilePicture = uploadProfilePicture;
window.changePassword = changePassword;
window.downloadUserData = downloadUserData;
window.requestNotificationPermission = requestNotificationPermission;
window.acceptNotifications = acceptNotifications;
window.dismissNotificationPrompt = dismissNotificationPrompt;
window.getCurrentLocation = getCurrentLocation;
window.startLocationTracking = startLocationTracking;
window.stopLocationTracking = stopLocationTracking;
window.checkIn = checkIn;
window.triggerSOS = triggerSOS;
window.endTrip = endTrip;
window.generateShareLink = generateShareLink;
window.authenticatedFetch = authenticatedFetch;
window.getCurrentTrip = getCurrentTrip;
window.createTrip = createTrip;
window.addContact = addContact;
window.removeContact = removeContact;