const axios = require('axios');

/**
 * Get directions from Open Source Routing Machine (OSRM)
 */
const getDirections = async (origin, destination, mode = 'driving', alternatives = true) => {
    // OSRM expects coordinates as lng,lat
    const formatCoords = (str) => {
        if (typeof str === 'string' && str.includes(',')) {
            const [lat, lng] = str.split(',').map(s => s.trim());
            return `${lng},${lat}`;
        }
        return str; // Assuming it's already in correct format or handled elsewhere
    };

    const start = formatCoords(origin);
    const end = formatCoords(destination);

    try {
        const response = await axios.get(`https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=full&geometries=polyline&steps=true`);

        if (response.data.code !== 'Ok') {
            throw new Error(`OSRM error: ${response.data.code}`);
        }

        return response.data.routes.map((route) => ({
            summary: route.legs[0].summary || 'Route',
            distance: { text: `${(route.distance / 1000).toFixed(1)} km`, value: route.distance },
            duration: { text: `${Math.round(route.duration / 60)} mins`, value: route.duration },
            startAddress: origin,
            endAddress: destination,
            steps: route.legs[0].steps.map((step) => ({
                instruction: step.maneuver.instruction,
                distance: { text: `${step.distance} m`, value: step.distance },
                duration: { text: `${Math.round(step.duration)} s`, value: step.duration },
                travelMode: mode.toUpperCase(),
            })),
            polyline: route.geometry,
            bounds: null, // OSRM doesn't provide bounds in the same format
            warnings: [],
        }));
    } catch (error) {
        console.error('OSRM directions failed:', error.message);
        return [];
    }
};

/**
 * Geocode an address using OpenStreetMap Nominatim
 */
const geocodeAddress = async (address) => {
    try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
            params: {
                q: address,
                format: 'json',
                limit: 1
            },
            headers: {
                'User-Agent': 'SmartTripPlanner/1.0'
            }
        });

        if (!response.data || response.data.length === 0) {
            throw new Error('No results found');
        }

        const result = response.data[0];
        return {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            formattedAddress: result.display_name,
            placeId: result.place_id.toString(),
        };
    } catch (error) {
        console.error('Nominatim geocoding failed:', error.message);
        throw error;
    }
};

/**
 * Get nearby places (Simplified fallback using Nominatim)
 */
const getNearbyPlaces = async (lat, lng, type, radius = 5000) => {
    try {
        // Nominatim can't really do "nearby" well without specific categories, 
        // using a placeholder or simplified search here.
        // For a true open-source alternative, Overpass API would be used.
        return [];
    } catch (error) {
        return [];
    }
};

/**
 * Calculate fuel cost based on distance
 */
const calculateFuelCost = (distanceMeters) => {
    const km = distanceMeters / 1000;
    const fuelPrice = parseFloat(process.env.FUEL_PRICE_PER_LITRE) || 106;
    const mileage = parseFloat(process.env.AVERAGE_MILEAGE_KM_PER_LITRE) || 15;
    const litresUsed = km / mileage;
    return Math.round(litresUsed * fuelPrice * 100) / 100;
};

/**
 * Estimate public transport fare
 */
const estimatePublicTransportFare = (distanceMeters) => {
    const km = distanceMeters / 1000;
    if (km <= 2) return 10;
    if (km <= 5) return 20;
    if (km <= 12) return 30;
    if (km <= 21) return 40;
    if (km <= 32) return 50;
    return Math.round(50 + (km - 32) * 1.5);
};

/**
 * Estimate ride-hailing fare
 */
const estimateRideFare = (distanceMeters, vehicleType = 'sedan') => {
    const km = distanceMeters / 1000;
    const rates = {
        auto: { base: 30, perKm: 12 },
        mini: { base: 50, perKm: 14 },
        sedan: { base: 75, perKm: 18 },
        suv: { base: 100, perKm: 22 },
        premium: { base: 150, perKm: 28 },
        bike: { base: 20, perKm: 8 },
    };
    const rate = rates[vehicleType] || rates.sedan;
    return Math.round(rate.base + km * rate.perKm);
};

module.exports = {
    getDirections,
    getNearbyPlaces,
    geocodeAddress,
    calculateFuelCost,
    estimatePublicTransportFare,
    estimateRideFare,
};
