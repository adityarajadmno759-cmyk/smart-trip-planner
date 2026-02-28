const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BOOKING_HOST = 'booking-com.p.rapidapi.com';

/* ─── helpers ─────────────────────────────────────────────── */

function rapidHeaders() {
    return {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': BOOKING_HOST,
    };
}

/** Map Booking.com review_score (0–10) to INR price estimate */
function scoreToPrice(score) {
    if (!score) return null;
    if (score >= 9) return 9000;
    if (score >= 8) return 5500;
    if (score >= 7) return 3500;
    return 1800;
}

/** Reverse geocode lat/lng → city name using Nominatim (no key needed) */
async function reverseGeocode(lat, lng) {
    const res = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'User-Agent': 'SmartTripPlanner/1.0' }, timeout: 5000 }
    );
    const a = res.data.address;
    return a?.city || a?.town || a?.village || a?.county || 'Unknown';
}

/* ─── GET /api/hotels/search ────────────────────────────────
   Query params: lat, lng, radius (m), minRating, sortBy, maxResults
────────────────────────────────────────────────────────────── */
router.get(
    '/search',
    [
        query('lat').isFloat().withMessage('Valid latitude required'),
        query('lng').isFloat().withMessage('Valid longitude required'),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty())
                return res.status(400).json({ error: errors.array()[0].msg });

            const {
                lat, lng,
                radius = 5000,
                minRating,
                sortBy = 'rating',
                maxResults = 20,
            } = req.query;

            // If no RapidAPI key — return rich mock data so frontend always works
            if (!RAPIDAPI_KEY || RAPIDAPI_KEY === 'your_rapidapi_key_here') {
                return res.json({
                    hotels: getMockHotels(parseFloat(lat), parseFloat(lng)),
                    total: 6,
                    source: 'mock',
                    note: 'Add RAPIDAPI_KEY to backend/.env for live Booking.com results',
                });
            }

            /* Step 1: Reverse geocode → city name */
            let cityName;
            try { cityName = await reverseGeocode(lat, lng); }
            catch { cityName = 'Hotel'; }

            /* Step 2: Booking.com — get destination ID */
            const locRes = await axios.get(
                `https://${BOOKING_HOST}/v1/hotels/locations`,
                {
                    headers: rapidHeaders(),
                    params: { name: cityName, locale: 'en-gb' },
                    timeout: 8000,
                }
            );

            const destItems = locRes.data;
            if (!destItems?.length) {
                // No match — fall back to mock
                return res.json({ hotels: getMockHotels(parseFloat(lat), parseFloat(lng)), total: 6, source: 'mock_no_dest' });
            }

            const dest = destItems[0];
            const destId = dest.dest_id;
            const destType = dest.dest_type;

            /* Step 3: Search hotels */
            // Booking.com needs check-in/out dates — use tomorrow + day after
            const checkin = formatDate(1);
            const checkout = formatDate(2);

            const searchRes = await axios.get(
                `https://${BOOKING_HOST}/v1/hotels/search`,
                {
                    headers: rapidHeaders(),
                    params: {
                        dest_id: destId,
                        dest_type: destType,
                        checkin_date: checkin,
                        checkout_date: checkout,
                        adults_number: 2,
                        room_number: 1,
                        units: 'metric',
                        order_by: sortBy === 'price_asc' ? 'price' : sortBy === 'popular' ? 'popularity' : 'review_score',
                        filter_by_currency: 'INR',
                        locale: 'en-gb',
                        page_number: 0,
                        rows: Math.min(parseInt(maxResults), 25),
                        include_adjacency: true,
                        radius: Math.round(parseInt(radius) / 1000), // km
                        latitude: lat,
                        longitude: lng,
                    },
                    timeout: 12000,
                }
            );

            const results = searchRes.data?.result || [];

            let hotels = results.map((h) => {
                const priceRaw = h.min_total_price || h.composite_price_breakdown?.gross_amount?.value;
                const price = Math.round(priceRaw || scoreToPrice(h.review_score) || 2500);

                return {
                    id: String(h.hotel_id),
                    name: h.hotel_name_trans || h.hotel_name,
                    address: [h.address, h.city, h.country_trans].filter(Boolean).join(', '),
                    lat: parseFloat(h.latitude),
                    lng: parseFloat(h.longitude),
                    rating: h.review_score ? parseFloat((h.review_score / 2).toFixed(1)) : null,
                    reviewScore: h.review_score || null,
                    reviewWord: h.review_score_word || null,
                    userRatingCount: h.review_nr || 0,
                    estimatedPrice: price,
                    priceDisplay: `₹${price.toLocaleString('en-IN')}/night`,
                    checkin,
                    checkout,
                    isOpen: true,
                    website: `https://www.booking.com/hotel/${h.url || ''}`,
                    photo: h.main_photo_url || null,
                    stars: h.class || null,
                    description: h.unit_configuration_label || h.wishlist_count ? `${h.wishlist_count} saved this` : null,
                    types: h.accommodation_type_name ? [h.accommodation_type_name] : ['Hotel'],
                    bookingUrl: `https://www.booking.com/hotel/${h.url || ''}?checkin=${checkin}&checkout=${checkout}&adults=2`,
                };
            });

            // Min rating filter
            if (minRating) hotels = hotels.filter(h => !h.rating || h.rating >= parseFloat(minRating));

            // Client-side sort
            if (sortBy === 'price_asc') hotels.sort((a, b) => (a.estimatedPrice || 9999) - (b.estimatedPrice || 9999));
            else if (sortBy === 'price_desc') hotels.sort((a, b) => (b.estimatedPrice || 0) - (a.estimatedPrice || 0));
            else if (sortBy === 'popular') hotels.sort((a, b) => (b.userRatingCount || 0) - (a.userRatingCount || 0));
            else hotels.sort((a, b) => (b.rating || 0) - (a.rating || 0));

            res.json({ hotels, total: hotels.length, source: 'booking.com', city: cityName });

        } catch (err) {
            console.error('Hotel search error:', err.response?.data || err.message);
            const { lat, lng } = req.query;
            res.json({
                hotels: getMockHotels(parseFloat(lat || 0), parseFloat(lng || 0)),
                total: 6,
                source: 'mock_error',
                error: err.message,
            });
        }
    }
);

/* ─── Date helpers ─────────────────────────────────────────── */
function formatDate(daysFromNow) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

/* ─── Mock fallback data ──────────────────────────────────── */
function getMockHotels(lat, lng) {
    return [
        { id: 'm1', name: 'The Grand Palace Hotel', address: 'Main Road, City Centre', lat, lng, rating: 4.5, reviewScore: 9.0, reviewWord: 'Exceptional', userRatingCount: 1240, estimatedPrice: 5500, priceDisplay: '₹5,500/night', isOpen: true, stars: 5, description: 'Luxury hotel in the heart of the city.' },
        { id: 'm2', name: 'Budget Stay Inn', address: 'Station Road', lat: lat + 0.01, lng: lng + 0.01, rating: 3.8, reviewScore: 7.6, reviewWord: 'Good', userRatingCount: 430, estimatedPrice: 1500, priceDisplay: '₹1,500/night', isOpen: true, stars: 2, description: 'Affordable rooms near the railway station.' },
        { id: 'm3', name: 'Heritage Haveli Resort', address: 'Old Town Quarter', lat: lat - 0.01, lng: lng + 0.005, rating: 4.7, reviewScore: 9.4, reviewWord: 'Exceptional', userRatingCount: 890, estimatedPrice: 8500, priceDisplay: '₹8,500/night', isOpen: true, stars: 5, description: 'Boutique heritage property with courtyard pool.' },
        { id: 'm4', name: 'City View Suites', address: 'Commercial Complex, Ring Road', lat: lat + 0.005, lng: lng - 0.01, rating: 4.1, reviewScore: 8.2, reviewWord: 'Very Good', userRatingCount: 620, estimatedPrice: 3500, priceDisplay: '₹3,500/night', isOpen: true, stars: 4, description: 'Modern business hotel with panoramic views.' },
        { id: 'm5', name: 'Backpacker Hostel Co.', address: 'University Road', lat: lat - 0.005, lng: lng - 0.005, rating: 4.2, reviewScore: 8.4, reviewWord: 'Very Good', userRatingCount: 215, estimatedPrice: 800, priceDisplay: '₹800/night', isOpen: true, stars: 1, description: 'Social hostel with shared dorms and rooftop.' },
        { id: 'm6', name: 'Lakeview Luxury Spa', address: 'Lakeside Boulevard', lat: lat + 0.02, lng: lng + 0.02, rating: 4.9, reviewScore: 9.8, reviewWord: 'Exceptional', userRatingCount: 340, estimatedPrice: 14000, priceDisplay: '₹14,000/night', isOpen: null, stars: 5, description: 'Five-star resort with spa and infinity pool.' },
    ];
}

module.exports = router;
