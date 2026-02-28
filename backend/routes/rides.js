const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const mapsService = require('../services/googleMaps');
const Booking = require('../models/Booking');
const { protect } = require('../middleware/auth');

const VEHICLE_TYPES = [
    { type: 'bike', label: 'Bike', emoji: '🏍️', seats: 1, baseTime: 3, eta: '3-5' },
    { type: 'auto', label: 'Auto', emoji: '🛺', seats: 3, baseTime: 5, eta: '5-8' },
    { type: 'mini', label: 'Mini', emoji: '🚗', seats: 4, baseTime: 6, eta: '6-10' },
    { type: 'sedan', label: 'Sedan', emoji: '🚖', seats: 4, baseTime: 7, eta: '7-12' },
    { type: 'suv', label: 'SUV', emoji: '🚙', seats: 6, baseTime: 8, eta: '8-15' },
    { type: 'premium', label: 'Premium', emoji: '🏎️', seats: 4, baseTime: 5, eta: '5-8' },
];

// @route GET /api/rides/estimate
router.get(
    '/estimate',
    [
        query('origin').notEmpty(),
        query('destination').notEmpty(),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty())
                return res.status(400).json({ error: errors.array()[0].msg });

            const { origin, destination } = req.query;

            // Get driving distance
            const routes = await mapsService.getDirections(origin, destination, 'driving', false);
            if (!routes.length) return res.status(404).json({ error: 'Could not find route' });

            const distanceMeters = routes[0].distance.value;
            const durationText = routes[0].duration.text;

            const vehicles = VEHICLE_TYPES.map((v) => ({
                ...v,
                fare: mapsService.estimateRideFare(distanceMeters, v.type),
                distanceKm: Math.round(distanceMeters / 100) / 10,
                duration: durationText,
            }));

            res.json({ vehicles, distance: routes[0].distance, duration: routes[0].duration });
        } catch (err) {
            next(err);
        }
    }
);

// @route POST /api/rides/book (protected)
router.post(
    '/book',
    protect,
    [
        body('origin').notEmpty(),
        body('destination').notEmpty(),
        body('vehicleType').isIn(VEHICLE_TYPES.map((v) => v.type)),
        body('estimatedFare').isNumeric(),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty())
                return res.status(400).json({ error: errors.array()[0].msg });

            const { origin, destination, vehicleType, estimatedFare, distanceKm } = req.body;
            const vehicle = VEHICLE_TYPES.find((v) => v.type === vehicleType);

            // Simulate driver assignment
            const driverNames = ['Rajesh Kumar', 'Suresh Singh', 'Arjun Patel', 'Mohan Das', 'Vikram Nair'];
            const driverName = driverNames[Math.floor(Math.random() * driverNames.length)];
            const plate = `DL${Math.floor(10 + Math.random() * 89)} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))} ${Math.floor(1000 + Math.random() * 9000)}`;

            const booking = await Booking.create({
                user: req.user._id,
                type: 'ride',
                ride: {
                    vehicleType,
                    origin,
                    destination,
                    estimatedFare,
                    estimatedArrival: parseInt(vehicle.eta.split('-')[0]),
                    distance: distanceKm,
                    driverName,
                    driverPhone: `+91 98${Math.floor(10000000 + Math.random() * 89999999)}`,
                    plateNumber: plate,
                },
                paidAmount: estimatedFare,
            });

            res.status(201).json({
                booking,
                message: `Your ${vehicle.label} is on its way! Driver: ${driverName} | ${plate}`,
            });
        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
