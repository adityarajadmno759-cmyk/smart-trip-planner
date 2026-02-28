const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Trip = require('../models/Trip');
const Booking = require('../models/Booking');

// @route GET /api/user/profile
router.get('/profile', protect, async (req, res) => {
    res.json({ user: req.user });
});

// @route PUT /api/user/profile
router.put(
    '/profile',
    protect,
    [body('name').optional().trim().notEmpty(), body('phone').optional().isMobilePhone()],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

            const { name, phone, preferences } = req.body;
            const update = {};
            if (name) update.name = name;
            if (phone) update.phone = phone;
            if (preferences) update.preferences = preferences;

            const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
            res.json({ user });
        } catch (err) {
            next(err);
        }
    }
);

// @route GET/POST /api/user/emergency-contacts
router.get('/emergency-contacts', protect, async (req, res) => {
    res.json({ contacts: req.user.emergencyContacts || [] });
});

router.post(
    '/emergency-contacts',
    protect,
    [body('name').notEmpty(), body('phone').notEmpty()],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

            const user = await User.findByIdAndUpdate(
                req.user._id,
                { $push: { emergencyContacts: req.body } },
                { new: true }
            );
            res.json({ contacts: user.emergencyContacts });
        } catch (err) {
            next(err);
        }
    }
);

router.delete('/emergency-contacts/:contactId', protect, async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $pull: { emergencyContacts: { _id: req.params.contactId } } },
            { new: true }
        );
        res.json({ contacts: user.emergencyContacts });
    } catch (err) {
        next(err);
    }
});

// @route GET /api/user/trips
router.get('/trips', protect, async (req, res, next) => {
    try {
        const trips = await Trip.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .select('-trackingPoints');
        res.json({ trips, total: trips.length });
    } catch (err) {
        next(err);
    }
});

// @route GET /api/user/bookings
router.get('/bookings', protect, async (req, res, next) => {
    try {
        const { type } = req.query;
        const filter = { user: req.user._id };
        if (type) filter.type = type;

        const bookings = await Booking.find(filter).sort({ createdAt: -1 }).limit(50);
        res.json({ bookings, total: bookings.length });
    } catch (err) {
        next(err);
    }
});

// @route POST /api/user/saved-routes
router.post('/saved-routes', protect, async (req, res, next) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $push: { savedRoutes: req.body } },
            { new: true }
        );
        res.json({ savedRoutes: user.savedRoutes });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
