const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const { protect } = require('../middleware/auth');

const RENTAL_FLEET = [
    // Two-wheelers
    { id: 'tw001', category: 'two-wheeler', name: 'Honda Activa 6G', type: 'Scooter', emoji: '🛵', pricePerHour: 40, pricePerDay: 350, seats: 2, fuelType: 'Petrol', available: true },
    { id: 'tw002', category: 'two-wheeler', name: 'Royal Enfield Classic 350', type: 'Motorcycle', emoji: '🏍️', pricePerHour: 80, pricePerDay: 700, seats: 2, fuelType: 'Petrol', available: true },
    { id: 'tw003', category: 'two-wheeler', name: 'TVS iQube Electric', type: 'E-Scooter', emoji: '⚡', pricePerHour: 35, pricePerDay: 300, seats: 2, fuelType: 'Electric', available: true },
    { id: 'tw004', category: 'two-wheeler', name: 'KTM Duke 200', type: 'Motorcycle', emoji: '🏍️', pricePerHour: 100, pricePerDay: 900, seats: 2, fuelType: 'Petrol', available: false },

    // Four-wheelers
    { id: 'fw001', category: 'four-wheeler', name: 'Maruti Swift', type: 'Hatchback', emoji: '🚗', pricePerHour: 120, pricePerDay: 1200, seats: 5, fuelType: 'Petrol', available: true },
    { id: 'fw002', category: 'four-wheeler', name: 'Hyundai Creta', type: 'SUV', emoji: '🚙', pricePerHour: 180, pricePerDay: 1800, seats: 5, fuelType: 'Petrol', available: true },
    { id: 'fw003', category: 'four-wheeler', name: 'Tata Nexon EV', type: 'Electric SUV', emoji: '⚡', pricePerHour: 160, pricePerDay: 1600, seats: 5, fuelType: 'Electric', available: true },
    { id: 'fw004', category: 'four-wheeler', name: 'Toyota Innova Crysta', type: 'MPV', emoji: '🚐', pricePerHour: 220, pricePerDay: 2200, seats: 7, fuelType: 'Diesel', available: true },
];

// @route GET /api/rentals/vehicles
router.get('/vehicles', (req, res) => {
    const { category, fuelType, available } = req.query;
    let fleet = [...RENTAL_FLEET];

    if (category) fleet = fleet.filter((v) => v.category === category);
    if (fuelType) fleet = fleet.filter((v) => v.fuelType.toLowerCase() === fuelType.toLowerCase());
    if (available === 'true') fleet = fleet.filter((v) => v.available);

    res.json({ vehicles: fleet, total: fleet.length });
});

// @route POST /api/rentals/book (protected)
router.post(
    '/book',
    protect,
    [
        body('vehicleId').notEmpty(),
        body('startTime').isISO8601(),
        body('endTime').isISO8601(),
        body('location').notEmpty(),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty())
                return res.status(400).json({ error: errors.array()[0].msg });

            const { vehicleId, startTime, endTime, location } = req.body;
            const vehicle = RENTAL_FLEET.find((v) => v.id === vehicleId);
            if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
            if (!vehicle.available) return res.status(400).json({ error: 'Vehicle not available' });

            const start = new Date(startTime);
            const end = new Date(endTime);
            const hours = Math.ceil((end - start) / (1000 * 60 * 60));
            const days = Math.floor(hours / 24);
            const remainingHours = hours % 24;

            const totalPrice = days > 0
                ? days * vehicle.pricePerDay + remainingHours * vehicle.pricePerHour
                : hours * vehicle.pricePerHour;

            const booking = await Booking.create({
                user: req.user._id,
                type: 'rental',
                rental: {
                    vehicleId,
                    vehicleType: vehicle.category,
                    vehicleName: vehicle.name,
                    pricePerHour: vehicle.pricePerHour,
                    pricePerDay: vehicle.pricePerDay,
                    startTime: start,
                    endTime: end,
                    totalPrice,
                    location,
                },
                paidAmount: totalPrice,
            });

            res.status(201).json({ booking, totalPrice, hours, message: `${vehicle.name} booked successfully!` });
        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
