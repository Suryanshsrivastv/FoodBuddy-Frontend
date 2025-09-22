// Configuration
const API_BASE_URL = 'https://foodbuddy-v1-mz47.onrender.com/api';
let city = null;
// State management
let currentUser = null;
let authToken = localStorage.getItem('jwtToken');

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

        // Admin feature: show Add Restaurant button if username is Suryansh16
        let addBtn = document.getElementById('addRestaurantBtn');
        if (currentUser && currentUser.username === 'Suryansh16') {
            if (!addBtn) {
                addBtn = document.createElement('button');
                addBtn.id = 'addRestaurantBtn';
                addBtn.className = 'nav-btn';
                addBtn.textContent = 'Add Restaurant';
                addBtn.addEventListener('click', () => showPage('addRestaurant'));
                navButtons.feed.parentNode.insertBefore(addBtn, navButtons.logout);
            }
            addBtn.classList.remove('hidden');
        } else if (addBtn) {
            addBtn.classList.add('hidden');
        }
    } else {
        // User is not logged in
        navButtons.login.classList.remove('hidden');
        navButtons.register.classList.remove('hidden');
        navButtons.profile.classList.add('hidden');
        navButtons.feed.classList.add('hidden');
        navButtons.logout.classList.add('hidden');
        const addBtn = document.getElementById('addRestaurantBtn');
        if (addBtn) addBtn.classList.add('hidden');
    }
}

function showPage(pageName) {
    // Hide all pages
    Object.values(pages).forEach(page => page.classList.remove('active'));
    
    // Remove active class from all nav buttons
    Object.values(navButtons).forEach(btn => btn.classList.remove('active'));
    
    if (pageName === 'addRestaurant') {
        renderAddRestaurantPage();
        document.getElementById('addRestaurantPage').classList.add('active');
        const addBtn = document.getElementById('addRestaurantBtn');
        if (addBtn) addBtn.classList.add('active');
        return;
    }

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
    } else if (pageName === 'register') {
        // Auto-fill location from localStorage if available
        const detectedCity = localStorage.getItem('detectedCity');
        const registerLocationInput = document.getElementById('registerHomeAddress');
        if (detectedCity && registerLocationInput && !registerLocationInput.value) {
            registerLocationInput.value = detectedCity;
        }
    }
}

// API functions
async function apiCall(endpoint, options = {}, requiresAuth = false) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config = {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
    };

    if (options.body) {
        config.body = options.body;
    }

    if (requiresAuth) {
        const jwtToken = localStorage.getItem('jwtToken');
        if (jwtToken) {
            config.headers.Authorization = `Bearer ${jwtToken}`;
        } else {
            console.error(`🔒 Auth Error: Attempted to call a protected route without a token.`);
        }
    }

    // Log the outgoing request
    console.group(`📤 API Request: ${config.method} ${endpoint}`);
    console.log('URL:', url);
    console.log('Config:', {
        method: config.method,
        headers: config.headers,
        body: config.body ? JSON.parse(config.body) : undefined
    });
    console.groupEnd();

    try {
        console.time(`⏱️ API ${endpoint}`);
        const response = await fetch(url, config);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        let responseData;
        
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        // Log the response
        console.group(`📥 API Response: ${config.method} ${endpoint}`);
        console.log('Status:', response.status);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));
        console.log('Data:', responseData);
        console.timeEnd(`⏱️ API ${endpoint}`);
        console.groupEnd();

        return responseData;
    } catch (error) {
        console.group(`❌ API Error: ${config.method} ${endpoint}`);
        console.error('Error:', error);
        console.timeEnd(`⏱️ API ${endpoint}`);
        console.groupEnd();
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

        // Store JWT token in localStorage
        localStorage.setItem('jwtToken', response.token);
        authToken = response.token;

        // Fetch user profile
        currentUser = await apiCall('/users/me', {}, true);

        updateAuthUI();
        showToast('Login successful!', 'success');
        showPage('home');
    } catch (error) {
        showToast('Login failed. Please check your credentials.');
    } finally {
        hideLoading();
    }
}

async function register(formData) {
    try {
        showLoading();

        // Get checked values from checkbox groups
        const favoriteCuisines = Array.from(document.querySelectorAll('#registerFavoriteCuisines input:checked'))
            .map(cb => cb.value);
        
        const dietaryRestrictions = Array.from(document.querySelectorAll('#registerDietaryRestrictions input:checked'))
            .map(cb => cb.value);

        // Prepare registration data
        const registrationData = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password'),
            preferences: {
                favoriteCuisines,
                dietaryRestrictions,
                defaultBudget: parseInt(formData.get('defaultBudget')) || 0,
                homeAddress: formData.get('homeAddress')
            }
        };

        await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify(registrationData)
        });
        
        showToast('Registration successful! Please login.', 'success');
        showPage('login');
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Registration failed. Please try again.');
    } finally {
        hideLoading();
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('jwtToken'); // <-- Correct key!
    updateAuthUI();
    showToast('Logged out successfully!', 'success');
    showPage('home');
}

// User profile functions
async function loadUserProfile() {
    try {
        showLoading();
        currentUser = await apiCall('/users/me', {}, true); // Pass requiresAuth = true
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
    document.getElementById('homeAddress').value = user.homeAddress || '';
    
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
        }, true);

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
        console.group('🔍 Quick Search');
        console.log('Search query:', query);
        showLoading();
        const queryParams = new URLSearchParams();
        queryParams.append('query', query);

        // Get distance from range slider if it exists
        const distanceRange = document.getElementById('distanceRange');
        const maxDistance = distanceRange ? distanceRange.value : 5;
        queryParams.append('maxDistanceKm', maxDistance);

        // Try to get user location
        try {
            const location = await getUserLocation();
            if (location) {
                queryParams.append('userLat', location.latitude);
                queryParams.append('userLon', location.longitude);
                queryParams.append('detectedCity', city);
            }
        } catch (error) {
            console.warn('Location not available:', error);
        }

        const results = await apiCall(`/restaurants/suggest?${queryParams.toString()}`);
        
        if (Array.isArray(results) && results.length > 0) {
            displayResults(results);
            showToast(`Found ${results.length} restaurants matching your search!`, 'success');
        } else {
            showToast('No restaurants found matching your search.', 'info');
        }
    } catch (error) {
        console.error('Search error:', error);
        showToast('Search failed. Please try again.', 'error');
    } finally {
        hideLoading();
        console.groupEnd();
    }
}

async function filterRestaurants(filters) {
    try {
        console.group('🔍 Filter Restaurants');
        console.log('Filter criteria:', filters);
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

        // Get distance from range slider if it exists
        const distanceRange = document.getElementById('distanceRange');
        const maxDistance = distanceRange ? distanceRange.value : 5;
        queryParams.append('maxDistanceKm', maxDistance);
        
        // Try to get user location
        try {
            const location = await getUserLocation();
            if (location) {
                queryParams.append('userLat', location.latitude);
                queryParams.append('userLon', location.longitude);
            }
        } catch (error) {
            console.warn('Location not available:', error);
        }
        
        const results = await apiCall(`/restaurants/filter?${queryParams.toString()}`);
        console.log('Received results:', results); // Debug log
        
        if (!results || !Array.isArray(results)) {
            console.warn('No valid results received from API');
            return null;
        }

        return results;
    } catch (error) {
        console.error('Filter error:', error);
        throw error;
    } finally {
        hideLoading();
        console.groupEnd();
    }
}

async function loadPersonalizedFeed() {
    try {
        showLoading();
        const feedResults = await apiCall('/feed', {}, true); // Pass requiresAuth = true
        
        if (!feedResults || !Array.isArray(feedResults)) {
            console.error('Invalid feed response:', feedResults);
            showToast('Failed to load personalized feed: Invalid response format');
            return;
        }
        
        console.log('Feed results:', feedResults);
        displayResults(feedResults, 'Your Personalized Feed', 'feedResults');
    } catch (error) {
        console.error('Feed error:', error);
        showToast('Failed to load personalized feed.');
    } finally {
        hideLoading();
    }
}

// Display functions
function displayResults(data, title = 'Restaurant Suggestions', containerId = 'resultsContent') {
    console.log('Display Results Data:', data); // Debug log
    
    const container = document.getElementById(containerId);
    // For feed, use the container directly as it already has the title
    const resultsContainer = containerId === 'feedResults' ? container : document.getElementById('searchResults');
    
    console.log('Container found:', !!container, 'Results container found:', !!resultsContainer); // Debug elements
    
    if (!container) {
        console.error('Container not found:', containerId);
        return;
    }

    if (containerId !== 'feedResults' && !resultsContainer) {
        console.error('Results container not found for search results');
        return;
    }

    if (containerId !== 'feedResults') {
        console.log('Before removing hidden class:', {
            classList: [...resultsContainer.classList],
            isHidden: resultsContainer.classList.contains('hidden')
        });

        resultsContainer.classList.remove('hidden');
        
        console.log('After removing hidden class:', {
            classList: [...resultsContainer.classList],
            isHidden: resultsContainer.classList.contains('hidden')
        });
    }

    // Clear previous results
    container.innerHTML = '';

    // Process the data based on its format
    let restaurantsToShow = [];
    if (Array.isArray(data)) {
        // Handle array format from filter endpoint or feed
        if (data.length > 0 && data[0].restaurant) {
            // Feed format with restaurant and relevance score
            restaurantsToShow = data.map(item => item.restaurant);
            console.log('Feed format detected:', restaurantsToShow);
        } else {
            // Direct array of restaurants
            restaurantsToShow = data;
            console.log('Array format detected:', restaurantsToShow);
        }
    } else if (typeof data === 'object') {
        if (data.restaurants) {
            // Handle object format with restaurants property
            restaurantsToShow = data.restaurants.map(item => item.restaurant);
            console.log('Object with restaurants array detected:', restaurantsToShow);
        } else {
            // Single restaurant object
            restaurantsToShow = [data];
            console.log('Single restaurant object detected:', restaurantsToShow);
        }
    }

    // Update the results title if not in feed mode
    if (containerId !== 'feedResults') {
        const titleElement = resultsContainer.querySelector('h2');
        if (titleElement) {
            titleElement.textContent = data.message || 'Restaurant Suggestions';
        }

        // Show fallback notice if specified
        if (data.isFallback) {
            const fallbackNotice = document.createElement('p');
            fallbackNotice.className = 'fallback-notice';
            fallbackNotice.textContent = 'Showing general results as no nearby restaurants were found.';
            container.appendChild(fallbackNotice);
        }
    }
    
    if (!restaurantsToShow || !restaurantsToShow.length) {
        console.log('No restaurants to show');
        container.innerHTML = '<p class="text-center">No restaurants found matching your criteria.</p>';
        return;
    }
    
    console.log('About to create grid with restaurants:', restaurantsToShow);
    const restaurantGrid = document.createElement('div');
    restaurantGrid.className = 'restaurant-grid';

    try {
        // Clear previous results first
        container.innerHTML = '';
        
        // Create restaurant grid
        const restaurantGrid = document.createElement('div');
        restaurantGrid.className = 'restaurant-grid';
        
        console.log('Creating restaurant cards for:', restaurantsToShow);
        
        // Create and append restaurant cards
        for (const restaurant of restaurantsToShow) {
            try {
                const card = createRestaurantCard(restaurant);
                if (card) {
                    restaurantGrid.appendChild(card);
                    console.log('Successfully created and added card for:', restaurant.name);
                } else {
                    console.error('Failed to create card for restaurant:', restaurant);
                }
            } catch (cardError) {
                console.error('Error creating restaurant card:', cardError, restaurant);
                continue; // Skip this card but continue with others
            }
        }
        
        // Only append grid if it has children
        if (restaurantGrid.children.length > 0) {
            container.appendChild(restaurantGrid);
            console.log('Successfully added grid with', restaurantGrid.children.length, 'restaurants');
        } else {
            container.innerHTML = '<p class="text-center">No restaurants could be displayed.</p>';
            console.error('No valid restaurant cards were created');
        }
    } catch (error) {
        console.error('Error displaying restaurants:', error);
        container.innerHTML = '<p class="text-center">Error displaying restaurants.</p>';
    }
    
    console.log('Final container state:', {
        innerHTML: container.innerHTML,
        childNodes: container.childNodes.length,
        display: window.getComputedStyle(container).display,
        parentDisplay: window.getComputedStyle(resultsContainer).display
    });

    // Smooth scroll to results section
    resultsContainer.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start'
    });

    // Add a small highlight animation to the results section
    resultsContainer.style.animation = 'none';
    resultsContainer.offsetHeight; // Trigger reflow
    resultsContainer.style.animation = 'highlight 1s ease-out';
}

function createRestaurantCard(restaurant) {
    const card = document.createElement('div');
    card.className = 'restaurant-card';

    // Handle different possible formats of the restaurant data
    const restaurantData = restaurant.restaurant || restaurant;
    const relevanceScore = restaurant.foodRelevanceScore || restaurant.relevanceScore;

    // Google Maps navigation link
    const latitude = restaurantData.latitude || 0.0;
    const longitude = restaurantData.longitude || 0.0;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

    card.innerHTML = `
        <h3>${restaurantData.name || 'Unknown Restaurant'}</h3>
        <div class="restaurant-info">
            <p><strong>Location:</strong> ${restaurantData.location || 'Not specified'}</p>
            ${restaurantData.distance ? `<p><strong>Distance:</strong> ${restaurantData.distance.toFixed(1)} km</p>` : ''}
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
        
        ${relevanceScore ? 
            `<div class="relevance-score">Match Score: ${Math.round(relevanceScore * 10)}%</div>` : 
            ''
        }
        <a 
            href="${mapsUrl}" 
            class="primary-btn nav-btn" 
            target="_blank"
            style="margin-top:10px;display:inline-block;"
        >Start Navigation</a>
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
        homeAddress: formData.get('homeAddress') || null
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

// Event listeners
// Get user's geolocation as a Promise
async function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => {
                console.warn('Error getting location:', error.message);
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Distance range slider event listener
    const distanceRange = document.getElementById('distanceRange');
    const distanceValue = document.getElementById('distanceValue');
    if (distanceRange && distanceValue) {
        distanceRange.addEventListener('input', function() {
            distanceValue.textContent = `${this.value} km`;
        });
    }

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

    // Register form handler
    const registerForm = document.getElementById('registerForm');
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        await register(formData);
    });
    
    // Form submissions
    document.getElementById('loginForm').addEventListener('submit', handleLoginForm);
    document.getElementById('registerForm').addEventListener('submit', handleRegisterForm);
    document.getElementById('profileForm').addEventListener('submit', handleProfileForm);
    
    // Guest questionnaire submission
    const guestForm = document.getElementById('guestQuestionnaire');
    if (guestForm) {
        guestForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(event.target);
            
            const filters = {
                city: formData.get('city'),
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
            
            try {
                showLoading();
                const results = await filterRestaurants(filters);
                if (results && results.length > 0) {
                    displayResults(results);
                    showToast(`Found ${results.length} restaurants matching your criteria!`, 'success');
                } else {
                    showToast('No restaurants found matching your criteria.', 'info');
                }
            } catch (error) {
                console.error('Search error:', error);
                showToast('An error occurred while searching. Please try again.', 'error');
            } finally {
                hideLoading();
            }
        });
    }
    
    // Quick search
    document.getElementById('quickSearchBtn').addEventListener('click', handleQuickSearch);
    document.getElementById('quickSearchInput').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            handleQuickSearch(event);
        }
    });
    
    // Autofill location input with detected city
    const locationInput = document.getElementById('location');
    if (locationInput && !locationInput.value) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
                    .then(res => res.json())
                    .then(data => {
                        const address = data.address || {};
                        city =
                            address.city ||
                            address.town ||
                            address.village ||
                            address.hamlet ||
                            address.state_district ||
                            address.county ||
                            address.state ||
                            address.region ||
                            address.municipality ||
                            address.locality ||
                            '';

                        if (city) {
                            console.log("city found: " + city);
                            locationInput.value = city;
                            localStorage.setItem('detectedCity', city);
                        } else {
                            console.log("city not found, address object:", address);
                        }
                    })
                    .catch(() => {});
            });
        }
    }
    
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

// Add Restaurant Page (placeholder)
function renderAddRestaurantPage() {
    const page = document.getElementById('addRestaurantPage');
    if (!page) {
        // Create the page if it doesn't exist
        const mainContent = document.querySelector('.main-content');
        const addPage = document.createElement('div');
        addPage.id = 'addRestaurantPage';
        addPage.className = 'page';
        addPage.innerHTML = `
            <div class="add-restaurant-container">
                <h2>Add Restaurant</h2>
                <form id="addRestaurantForm" class="add-restaurant-form">
                    <div class="form-group">
                        <label for="restaurantName">Name</label>
                        <input type="text" id="restaurantName" name="name" required>
                    </div>
                    <div class="form-group">
                        <label for="restaurantLocation">Location</label>
                        <input type="text" id="restaurantLocation" name="location" required>
                    </div>
                    <div class="form-group">
                        <label for="restaurantPriceMin">Min Price</label>
                        <input type="number" id="restaurantPriceMin" name="priceMin" min="0" required>
                    </div>
                    <div class="form-group">
                        <label for="restaurantPriceMax">Max Price</label>
                        <input type="number" id="restaurantPriceMax" name="priceMax" min="0" required>
                    </div>
                    <button type="submit" class="primary-btn">Add Restaurant</button>
                </form>
            </div>
        `;
        mainContent.appendChild(addPage);

        // Add form handler (placeholder)
        document.getElementById('addRestaurantForm').addEventListener('submit', function(event) {
            event.preventDefault();
            showToast('Restaurant added (placeholder)', 'success');
            showPage('home');
        });
    }
}