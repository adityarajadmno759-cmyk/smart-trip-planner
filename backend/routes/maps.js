const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const mapsService = require('../services/googleMaps');
const airQualityService = require('../services/airQuality');
const Trip = require('../models/Trip');
const { protect } = require('../middleware/auth');

// @route GET /api/maps/directions
// @desc  Get directions between two points for multiple modes
router.get(
    '/directions',
    [
        query('origin').notEmpty().withMessage('Origin is required'),
        query('destination').notEmpty().withMessage('Destination is required'),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty())
                return res.status(400).json({ error: errors.array()[0].msg });

            const { origin, destination, modes } = req.query;
            const requestedModes = modes ? modes.split(',') : ['driving', 'walking', 'transit'];

            // Fetch routes for each mode in parallel
            const routePromises = requestedModes.map((mode) =>
                mapsService.getDirections(origin, destination, mode, true).catch(() => [])
            );
            const routeResults = await Promise.all(routePromises);

            // Combine into { mode: routes[] } object
            const routesByMode = {};
            requestedModes.forEach((mode, i) => {
                if (routeResults[i].length > 0) {
                    routesByMode[mode] = routeResults[i].map((route) => ({
                        ...route,
                        mode,
                        fuelCost:
                            mode === 'driving'
                                ? mapsService.calculateFuelCost(route.distance.value)
                                : null,
                        transitFare:
                            mode === 'transit' || mode === 'walking'
                                ? mapsService.estimatePublicTransportFare(route.distance.value)
                                : null,
                    }));
                }
            });

            // Get pollution data for the route corridor
            let pollution = null;
            try {
                const [oLat, oLng] = typeof origin === 'string' && origin.includes(',')
                    ? origin.split(',').map(Number)
                    : [0, 0];
                const [dLat, dLng] = typeof destination === 'string' && destination.includes(',')
                    ? destination.split(',').map(Number)
                    : [0, 0];

                if (oLat && oLng && dLat && dLng) {
                    pollution = await airQualityService.estimateRoutePollution(oLat, oLng, dLat, dLng);
                }
            } catch (_) { }

            res.json({ routes: routesByMode, pollution });
        } catch (err) {
            next(err);
        }
    }
);

// @route GET /api/maps/geocode
router.get('/geocode', async (req, res, next) => {
    try {
        const { address } = req.query;
        if (!address) return res.status(400).json({ error: 'Address is required' });
        const result = await mapsService.geocodeAddress(address);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// @route GET /api/maps/airquality
router.get('/airquality', async (req, res, next) => {
    try {
        const { lat, lng } = req.query;
        if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });
        const aq = await airQualityService.getAirQuality(lat, lng);
        res.json(aq);
    } catch (err) {
        next(err);
    }
});

// @route POST /api/maps/save-trip  (protected)
router.post('/save-trip', protect, async (req, res, next) => {
    try {
        const tripData = { ...req.body, user: req.user._id };
        const trip = await Trip.create(tripData);
        res.status(201).json({ trip });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
