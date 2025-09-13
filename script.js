// Configuration
const API_BASE_URL = 'http://localhost:8080/api'; // Change this to your backend URL

// State management
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// DOM elements
const pages = {
    home: document.getElementById('homePage'),
    login: document.getElementById('loginPage'),
    register: document.getElementById('registerPage'),
    profile: document.getElementById('profilePage'),
    feed: document.getElementById('feedPage')
};

const navButtons = {
    home: document.getElementById('homeBtn'),
    login: document.getElementById('loginBtn'),
    register: document.getElementById('registerBtn'),
    profile: document.getElementById('profileBtn'),
    feed: document.getElementById('feedBtn'),
    logout: document.getElementById('logoutBtn')
};

// Utility functions
function showToast(message, type = 'error') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading() {
    document.getElementById('loadingSpinner').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingSpinner').classList.add('hidden');
}

function updateAuthUI() {
    if (authToken) {
        // User is logged in
        navButtons.login.classList.add('hidden');
        navButtons.register.classList.add('hidden');
        navButtons.profile.classList.remove('hidden');
        navButtons.feed.classList.remove('hidden');
        navButtons.logout.classList.remove('hidden');
    } else {
        // User is not logged in
        navButtons.login.classList.remove('hidden');
        navButtons.register.classList.remove('hidden');
        navButtons.profile.classList.add('hidden');
        navButtons.feed.classList.add('hidden');
        navButtons.logout.classList.add('hidden');
    }
}

function showPage(pageName) {
    // Hide all pages
    Object.values(pages).forEach(page => page.classList.remove('active'));
    
    // Remove active class from all nav buttons
    Object.values(navButtons).forEach(btn => btn.classList.remove('active'));
    
    // Show selected page
    if (pages[pageName]) {
        pages[pageName].classList.add('active');
        if (navButtons[pageName]) {
            navButtons[pageName].classList.add('active');
        }
    }
    
    // Load page-specific data
    if (pageName === 'profile' && authToken) {
        loadUserProfile();
    } else if (pageName === 'feed' && authToken) {
        loadPersonalizedFeed();
    }
}

// API functions
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    
    if (authToken && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }
    
    try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return await response.text();
        }
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Authentication functions
async function login(username, password) {
    try {
        showLoading();
        const response = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        authToken = response.token;
        localStorage.setItem('authToken', authToken);
        updateAuthUI();
        showToast('Login successful!', 'success');
        showPage('home');
    } catch (error) {
        showToast('Login failed. Please check your credentials.');
    } finally {
        hideLoading();
    }
}

async function register(username, email, password) {
    try {
        showLoading();
        await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        
        showToast('Registration successful! Please login.', 'success');
        showPage('login');
    } catch (error) {
        showToast('Registration failed. Please try again.');
    } finally {
        hideLoading();
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    updateAuthUI();
    showToast('Logged out successfully!', 'success');
    showPage('home');
}

// User profile functions
async function loadUserProfile() {
    try {
        showLoading();
        currentUser = await apiCall('/users/me');
        populateProfileForm(currentUser);
    } catch (error) {
        showToast('Failed to load profile data.');
    } finally {
        hideLoading();
    }
}

function populateProfileForm(user) {
    document.getElementById('profileUsername').value = user.username || '';
    document.getElementById('profileEmail').value = user.email || '';
    document.getElementById('defaultBudget').value = user.defaultBudget || '';
    document.getElementById('preferredLocation').value = user.preferredLocation || '';
    
    // Handle favorite cuisines
    const favoriteCuisines = user.favoriteCuisines || [];
    document.querySelectorAll('input[name="favoriteCuisines"]').forEach(checkbox => {
        checkbox.checked = favoriteCuisines.includes(checkbox.value);
    });
    
    // Handle dietary restrictions
    const dietaryRestrictions = user.dietaryRestrictions || [];
    document.querySelectorAll('input[name="dietaryRestrictions"]').forEach(checkbox => {
        checkbox.checked = dietaryRestrictions.includes(checkbox.value);
    });
}

async function updateUserProfile(profileData) {
    try {
        showLoading();
        const updatedUser = await apiCall('/users/me', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
        
        currentUser = updatedUser;
        showToast('Profile updated successfully!', 'success');
    } catch (error) {
        showToast('Failed to update profile.');
    } finally {
        hideLoading();
    }
}

// Restaurant search functions
async function quickSearch(query) {
    try {
        showLoading();
        const results = await apiCall(`/restaurants/suggest?query=${encodeURIComponent(query)}`);
        displayResults(results, 'Search Results');
    } catch (error) {
        showToast('Search failed. Please try again.');
    } finally {
        hideLoading();
    }
}

async function filterRestaurants(filters) {
    try {
        showLoading();
        const queryParams = new URLSearchParams();
        
        // Add filters to query params
        Object.entries(filters).forEach(([key, value]) => {
            if (value && value.length > 0) {
                if (Array.isArray(value)) {
                    value.forEach(v => queryParams.append(key, v));
                } else {
                    queryParams.append(key, value);
                }
            }
        });
        
        const results = await apiCall(`/restaurants/filter?${queryParams.toString()}`);
        displayResults(results, 'Restaurant Suggestions');
    } catch (error) {
        showToast('Failed to find restaurants. Please try again.');
    } finally {
        hideLoading();
    }
}

async function loadPersonalizedFeed() {
    try {
        showLoading();
        const feedResults = await apiCall('/feed/');
        displayResults(feedResults, 'Your Personalized Feed', 'feedResults');
    } catch (error) {
        showToast('Failed to load personalized feed.');
    } finally {
        hideLoading();
    }
}

// Display functions
function displayResults(restaurants, title, containerId = 'resultsContent') {
    const container = document.getElementById(containerId);
    const resultsContainer = containerId === 'feedResults' ? 
        document.getElementById('searchResults') : 
        document.getElementById('searchResults');
    
    if (containerId === 'resultsContent') {
        resultsContainer.classList.remove('hidden');
        resultsContainer.querySelector('h2').textContent = title;
    }
    
    if (!restaurants || restaurants.length === 0) {
        container.innerHTML = '<p class="text-center">No restaurants found matching your criteria.</p>';
        return;
    }
    
    const restaurantGrid = document.createElement('div');
    restaurantGrid.className = 'restaurant-grid';
    
    restaurants.forEach(restaurant => {
        const card = createRestaurantCard(restaurant);
        restaurantGrid.appendChild(card);
    });
    
    container.innerHTML = '';
    container.appendChild(restaurantGrid);
}

function createRestaurantCard(restaurant) {
    const card = document.createElement('div');
    card.className = 'restaurant-card';
    
    const isRankedRestaurant = restaurant.hasOwnProperty('restaurant');
    const restaurantData = isRankedRestaurant ? restaurant.restaurant : restaurant;
    const relevanceScore = isRankedRestaurant ? restaurant.foodRelevanceScore : null;
    
    card.innerHTML = `
        <h3>${restaurantData.name || 'Unknown Restaurant'}</h3>
        <div class="restaurant-info">
            <p><strong>Location:</strong> ${restaurantData.location || 'Not specified'}</p>
            <p><strong>Price Range:</strong> ₹${restaurantData.priceMin || 0} - ₹${restaurantData.priceMax || 'N/A'}</p>
            ${restaurantData.rating ? `<p><strong>Rating:</strong> ${restaurantData.rating} ⭐</p>` : ''}
            ${restaurantData.description ? `<p><strong>Description:</strong> ${restaurantData.description}</p>` : ''}
        </div>
        
        <div class="restaurant-tags">
            ${restaurantData.cuisines ? restaurantData.cuisines.map(cuisine => 
                `<span class="tag cuisine-tag">${formatTag(cuisine)}</span>`
            ).join('') : ''}
            
            ${restaurantData.dietaryOptions ? restaurantData.dietaryOptions.map(option => 
                `<span class="tag dietary-tag">${formatTag(option)}</span>`
            ).join('') : ''}
            
            ${restaurantData.occasionTags ? restaurantData.occasionTags.map(occasion => 
                `<span class="tag occasion-tag">${formatTag(occasion)}</span>`
            ).join('') : ''}
            
            ${restaurantData.ambienceTags ? restaurantData.ambienceTags.map(ambience => 
                `<span class="tag">${formatTag(ambience)}</span>`
            ).join('') : ''}
        </div>
        
        ${relevanceScore !== null ? 
            `<div class="relevance-score">Relevance: ${relevanceScore.toFixed(1)}%</div>` : 
            ''
        }
    `;
    
    return card;
}

function formatTag(tag) {
    return tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Form handlers
function handleLoginForm(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const username = formData.get('username');
    const password = formData.get('password');
    login(username, password);
}

function handleRegisterForm(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const username = formData.get('username');
    const email = formData.get('email');
    const password = formData.get('password');
    register(username, email, password);
}

function handleProfileForm(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    const profileData = {
        favoriteCuisines: Array.from(document.querySelectorAll('input[name="favoriteCuisines"]:checked'))
            .map(cb => cb.value),
        dietaryRestrictions: Array.from(document.querySelectorAll('input[name="dietaryRestrictions"]:checked'))
            .map(cb => cb.value),
        defaultBudget: parseInt(formData.get('defaultBudget')) || null,
        preferredLocation: formData.get('preferredLocation') || null
    };
    
    updateUserProfile(profileData);
}

function handleQuickSearch(event) {
    event.preventDefault();
    const query = document.getElementById('quickSearchInput').value.trim();
    if (query) {
        quickSearch(query);
    }
}

function handleGuestQuestionnaire(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    const filters = {
        location: formData.get('location'),
        cuisines: formData.getAll('cuisines'),
        dietaryOptions: formData.getAll('dietaryOptions'),
        occasionTags: formData.getAll('occasionTags'),
        maxPrice: parseInt(formData.get('maxPrice')) || null
    };
    
    // Remove empty values
    Object.keys(filters).forEach(key => {
        if (!filters[key] || (Array.isArray(filters[key]) && filters[key].length === 0)) {
            delete filters[key];
        }
    });
    
    filterRestaurants(filters);
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Navigation event listeners
    navButtons.home.addEventListener('click', () => showPage('home'));
    navButtons.login.addEventListener('click', () => showPage('login'));
    navButtons.register.addEventListener('click', () => showPage('register'));
    navButtons.profile.addEventListener('click', () => showPage('profile'));
    navButtons.feed.addEventListener('click', () => showPage('feed'));
    navButtons.logout.addEventListener('click', logout);
    
    // Auth form switches
    document.getElementById('switchToRegister').addEventListener('click', () => showPage('register'));
    document.getElementById('switchToLogin').addEventListener('click', () => showPage('login'));
    
    // Form submissions
    document.getElementById('loginForm').addEventListener('submit', handleLoginForm);
    document.getElementById('registerForm').addEventListener('submit', handleRegisterForm);
    document.getElementById('profileForm').addEventListener('submit', handleProfileForm);
    document.getElementById('guestQuestionnaire').addEventListener('submit', handleGuestQuestionnaire);
    
    // Quick search
    document.getElementById('quickSearchBtn').addEventListener('click', handleQuickSearch);
    document.getElementById('quickSearchInput').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            handleQuickSearch(event);
        }
    });
    
    // Initialize UI
    updateAuthUI();
    showPage('home');
    
    // Load user profile if already logged in
    if (authToken) {
        loadUserProfile().catch(() => {
            // Token might be expired, logout
            logout();
        });
    }
});