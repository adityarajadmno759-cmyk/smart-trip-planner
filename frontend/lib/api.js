import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: `${API_BASE}/api`,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = Cookies.get('stp_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Handle 401 globally (token expired/invalid)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            Cookies.remove('stp_token');
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:logout'));
            }
        }
        return Promise.reject(error);
    }
);

// ─── Auth ──────────────────────────────────────────────────────────
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    me: () => api.get('/auth/me'),
    googleLogin: () => { window.location.href = `${API_BASE}/api/auth/google`; },
};

// ─── Maps & Routes ─────────────────────────────────────────────────
export const mapsAPI = {
    getDirections: (params) => api.get('/maps/directions', { params }),
    geocode: (address) => api.get('/maps/geocode', { params: { address } }),
    getAirQuality: (lat, lng) => api.get('/maps/airquality', { params: { lat, lng } }),
    saveTrip: (data) => api.post('/maps/save-trip', data),
};

// ─── Hotels ────────────────────────────────────────────────────────
export const hotelsAPI = {
    search: (params) => api.get('/hotels/search', { params }),
};

// ─── Rides ─────────────────────────────────────────────────────────
export const ridesAPI = {
    estimate: (params) => api.get('/rides/estimate', { params }),
    book: (data) => api.post('/rides/book', data),
};

// ─── Rentals ───────────────────────────────────────────────────────
export const rentalsAPI = {
    getVehicles: (params) => api.get('/rentals/vehicles', { params }),
    book: (data) => api.post('/rentals/book', data),
};

// ─── Tickets ───────────────────────────────────────────────────────
export const ticketsAPI = {
    getPlaces: (params) => api.get('/tickets/places', { params }),
    book: (data) => api.post('/tickets/book', data),
};

// ─── Safety ────────────────────────────────────────────────────────
export const safetyAPI = {
    sendSOS: (data) => api.post('/safety/sos', data),
    trackLocation: (data) => api.post('/safety/track-location', data),
};

// ─── User ──────────────────────────────────────────────────────────
export const userAPI = {
    getProfile: () => api.get('/user/profile'),
    updateProfile: (data) => api.put('/user/profile', data),
    getTrips: () => api.get('/user/trips'),
    getBookings: (type) => api.get('/user/bookings', { params: type ? { type } : {} }),
    getEmergencyContacts: () => api.get('/user/emergency-contacts'),
    addEmergencyContact: (data) => api.post('/user/emergency-contacts', data),
    deleteEmergencyContact: (id) => api.delete(`/user/emergency-contacts/${id}`),
    saveRoute: (data) => api.post('/user/saved-routes', data),
};

export default api;
