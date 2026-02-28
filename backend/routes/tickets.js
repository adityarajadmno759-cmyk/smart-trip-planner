const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const axios = require('axios');
const Booking = require('../models/Booking');
const { protect } = require('../middleware/auth');

/* ─── Ticket pricing by attraction type ───────────────────── */
const TICKET_PRICING = {
    default: { adult: 50, child: 25 },
    museum: { adult: 100, child: 50 },
    historical: { adult: 75, child: 40 },
    monument: { adult: 75, child: 40 },
    artwork: { adult: 30, child: 15 },
    amusement_park: { adult: 500, child: 300 },
    theme_park: { adult: 600, child: 350 },
    temple: { adult: 0, child: 0 },
    church: { adult: 0, child: 0 },
    mosque: { adult: 0, child: 0 },
    place_of_worship: { adult: 0, child: 0 },
    zoo: { adult: 150, child: 80 },
    aquarium: { adult: 200, child: 100 },
    viewpoint: { adult: 0, child: 0 },
    park: { adult: 0, child: 0 },
    garden: { adult: 20, child: 10 },
    ruins: { adult: 50, child: 25 },
    castle: { adult: 100, child: 60 },
    fort: { adult: 80, child: 40 },
};

const TIME_SLOTS = [
    '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM',
];

/* ─── Overpass API: fetch tourist attractions near lat/lng ── */
async function fetchAttractions(lat, lng, radius = 10000) {
    // Overpass query: tourism=* OR historic=* OR leisure=* within radius
    const overpassQuery = `
[out:json][timeout:20];
(
  node["tourism"](around:${radius},${lat},${lng});
  node["historic"](around:${radius},${lat},${lng});
  node["leisure"~"^(park|garden|zoo|water_park|wildlife_reserve|nature_reserve)$"](around:${radius},${lat},${lng});
  node["amenity"~"^(theatre|cinema|museum|place_of_worship|aquarium)$"](around:${radius},${lat},${lng});
  way["tourism"](around:${radius},${lat},${lng});
  way["historic"](around:${radius},${lat},${lng});
);
out center tags 20;
`;

    const res = await axios.post(
        'https://overpass-api.de/api/interpreter',
        `data=${encodeURIComponent(overpassQuery)}`,
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 25000,
        }
    );
    return res.data.elements || [];
}

function detectType(tags) {
    if (tags.tourism) return tags.tourism;
    if (tags.historic) return tags.historic;
    if (tags.leisure) return tags.leisure;
    if (tags.amenity) return tags.amenity;
    return 'attraction';
}

function getPricingKey(type) {
    if (TICKET_PRICING[type]) return type;
    // fuzzy match
    if (type.includes('museum')) return 'museum';
    if (type.includes('temple') || type.includes('mandir') || type.includes('shrine')) return 'temple';
    if (type.includes('church') || type.includes('cathedral')) return 'church';
    if (type.includes('mosque') || type.includes('masjid')) return 'mosque';
    if (type.includes('fort') || type.includes('qila')) return 'fort';
    if (type.includes('castle') || type.includes('palace')) return 'castle';
    if (type.includes('zoo') || type.includes('wildlife')) return 'zoo';
    if (type.includes('monument')) return 'monument';
    if (type.includes('ruins') || type.includes('archaeological')) return 'ruins';
    if (type.includes('park') || type.includes('garden')) return 'park';
    return 'default';
}

/* ─── GET /api/tickets/places ───────────────────────────────  */
router.get(
    '/places',
    [
        query('lat').isFloat().withMessage('Valid latitude required'),
        query('lng').isFloat().withMessage('Valid longitude required'),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty())
                return res.status(400).json({ error: errors.array()[0].msg });

            const { lat, lng, radius = 15000, maxResults = 20 } = req.query;

            let elements = [];
            try {
                elements = await fetchAttractions(
                    parseFloat(lat), parseFloat(lng), Math.min(parseInt(radius), 30000)
                );
            } catch (e) {
                console.error('Overpass API error:', e.message);
                // Fall back to mock data
                elements = [];
            }

            // Filter: must have a name
            elements = elements.filter(e => e.tags?.name);

            // Deduplicate by name
            const seen = new Set();
            elements = elements.filter(e => {
                const k = e.tags.name.toLowerCase();
                if (seen.has(k)) return false;
                seen.add(k); return true;
            });

            const hour = new Date().getHours();
            const isPeakHour = hour >= 10 && hour <= 16;

            const places = elements.slice(0, parseInt(maxResults)).map((el) => {
                const tags = el.tags || {};
                const type = detectType(tags);
                const pricingKey = getPricingKey(type);
                const pricing = TICKET_PRICING[pricingKey];
                const queueEstimate = isPeakHour ? Math.floor(15 + Math.random() * 45) : Math.floor(2 + Math.random() * 15);

                // Coordinates
                const elLat = el.lat || el.center?.lat;
                const elLng = el.lon || el.center?.lon;

                // Build address from tags
                const addrParts = [tags['addr:street'], tags['addr:city'], tags['addr:state']].filter(Boolean);
                const address = addrParts.length > 0 ? addrParts.join(', ') : `Near ${lat.toString().slice(0, 6)}, ${lng.toString().slice(0, 6)}`;

                return {
                    id: String(el.id),
                    name: tags.name,
                    address,
                    lat: elLat,
                    lng: elLng,
                    rating: tags.rating ? parseFloat(tags.rating) : (3.5 + Math.random() * 1.5).toFixed(1) * 1,
                    userRatingCount: Math.floor(50 + Math.random() * 2000),
                    isOpen: true,
                    types: [type],
                    description: tags.description || tags.inscription || tags['wikipedia'] ? `Wikipedia: ${tags.wikipedia}` : null,
                    phone: tags.phone || tags['contact:phone'] || null,
                    website: tags.website || tags['contact:website'] || null,
                    pricing,
                    isFree: pricing.adult === 0,
                    timeSlots: TIME_SLOTS,
                    queueEstimate,
                    expectedWait: `${queueEstimate} minutes`,
                    openingHours: tags.opening_hours || null,
                    source: 'openstreetmap',
                };
            });

            // If Overpass returns nothing, send rich mock fallback
            if (places.length === 0) {
                return res.json({ places: getMockPlaces(parseFloat(lat), parseFloat(lng)), total: 6, source: 'mock' });
            }

            res.json({ places, total: places.length, source: 'overpass' });
        } catch (err) {
            next(err);
        }
    }
);

/* ─── Mock fallback data ────────────────────────────────────── */
function getMockPlaces(lat, lng) {
    return [
        { id: 'm1', name: 'City Museum', address: 'Museum Road', lat, lng, rating: 4.3, userRatingCount: 1200, isOpen: true, types: ['museum'], description: 'Rich collection of local history and art.', pricing: TICKET_PRICING.museum, isFree: false, timeSlots: TIME_SLOTS, queueEstimate: 15, expectedWait: '15 minutes' },
        { id: 'm2', name: 'Historic Fort', address: 'Fort Road', lat: lat + 0.01, lng: lng + 0.01, rating: 4.6, userRatingCount: 3400, isOpen: true, types: ['fort'], description: 'Centuries-old fort with panoramic views.', pricing: TICKET_PRICING.fort, isFree: false, timeSlots: TIME_SLOTS, queueEstimate: 30, expectedWait: '30 minutes' },
        { id: 'm3', name: 'Botanical Garden', address: 'Garden Avenue', lat: lat - 0.01, lng: lng + 0.005, rating: 4.1, userRatingCount: 890, isOpen: true, types: ['garden'], description: 'Beautiful green gardens with rare plant species.', pricing: TICKET_PRICING.garden, isFree: false, timeSlots: TIME_SLOTS, queueEstimate: 8, expectedWait: '8 minutes' },
        { id: 'm4', name: 'Ancient Temple', address: 'Temple Street', lat: lat + 0.005, lng: lng - 0.01, rating: 4.7, userRatingCount: 5600, isOpen: true, types: ['temple'], description: 'Sacred temple with intricate carvings.', pricing: TICKET_PRICING.temple, isFree: true, timeSlots: TIME_SLOTS, queueEstimate: 20, expectedWait: '20 minutes' },
        { id: 'm5', name: 'Art Gallery', address: 'Cultural Complex', lat: lat - 0.005, lng: lng - 0.005, rating: 4.0, userRatingCount: 420, isOpen: true, types: ['museum'], description: 'Contemporary and traditional art exhibitions.', pricing: TICKET_PRICING.museum, isFree: false, timeSlots: TIME_SLOTS, queueEstimate: 5, expectedWait: '5 minutes' },
        { id: 'm6', name: 'City Zoo', address: 'Zoo Park Road', lat: lat + 0.02, lng: lng + 0.02, rating: 4.4, userRatingCount: 7800, isOpen: true, types: ['zoo'], description: 'Home to 300+ species of animals and birds.', pricing: TICKET_PRICING.zoo, isFree: false, timeSlots: TIME_SLOTS, queueEstimate: 40, expectedWait: '40 minutes' },
    ];
}

/* ─── POST /api/tickets/book (protected) ────────────────────── */
router.post(
    '/book',
    protect,
    [
        body('placeId').notEmpty(),
        body('placeName').notEmpty(),
        body('visitDate').isISO8601(),
        body('timeSlot').notEmpty(),
        body('numberOfPersons').isInt({ min: 1 }),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty())
                return res.status(400).json({ error: errors.array()[0].msg });

            const { placeId, placeName, placeAddress, visitDate, timeSlot, numberOfPersons, pricingType = 'adult' } = req.body;

            const placeTypes = req.body.placeTypes || [];
            let pricingKey = 'default';
            for (const t of placeTypes) {
                const pk = getPricingKey(t);
                if (pk !== 'default') { pricingKey = pk; break; }
            }
            const pricePerPerson = TICKET_PRICING[pricingKey][pricingType] ?? TICKET_PRICING.default.adult;
            const totalPrice = pricePerPerson * parseInt(numberOfPersons);

            const queueEstimate = Math.floor(5 + Math.random() * 30);
            const match = timeSlot.match(/(\d+):(\d+) (AM|PM)/);
            const [, slotHour, slotMinute, period] = match || ['', '10', '00', 'AM'];
            const entryMinRaw = parseInt(slotMinute) + (queueEstimate % 60);
            const entryHour = (parseInt(slotHour) + Math.floor(queueEstimate / 60) + Math.floor(entryMinRaw / 60)) % 12 || 12;
            const entryMin = entryMinRaw % 60;
            const expectedEntryTime = `${String(entryHour).padStart(2, '0')}:${String(entryMin).padStart(2, '0')} ${period}`;

            const booking = await Booking.create({
                user: req.user._id,
                type: 'ticket',
                ticket: { placeId, placeName, placeAddress, visitDate: new Date(visitDate), timeSlot, numberOfPersons: parseInt(numberOfPersons), pricePerPerson, totalPrice, queueEstimate, expectedEntryTime },
                paidAmount: totalPrice,
            });

            res.status(201).json({
                booking,
                message: `Ticket booked for ${placeName}! Expected entry at ${expectedEntryTime}`,
            });
        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
