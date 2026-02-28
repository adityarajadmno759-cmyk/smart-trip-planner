const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const Trip = require('../models/Trip');

// @route POST /api/safety/sos  (protected)
// @desc  Send SOS alert with live location
router.post(
    '/sos',
    protect,
    [
        body('lat').isFloat().withMessage('Valid latitude required'),
        body('lng').isFloat().withMessage('Valid longitude required'),
        body('message').optional().isString(),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty())
                return res.status(400).json({ error: errors.array()[0].msg });

            const { lat, lng, message, tripId } = req.body;
            const user = req.user;

            const googleMapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
            const sosMessage = message || `🆘 EMERGENCY ALERT from ${user.name}!\nLive Location: ${googleMapsLink}\nTime: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\nPlease respond immediately!`;

            // Build notification log
            const notifications = [];

            // Notify emergency contacts (simulation - in production, integrate Twilio/SendGrid)
            if (user.emergencyContacts && user.emergencyContacts.length > 0) {
                user.emergencyContacts.forEach((contact) => {
                    notifications.push({
                        type: 'emergency_contact',
                        name: contact.name,
                        phone: contact.phone,
                        email: contact.email,
                        status: 'notified', // In prod: send SMS/email via Twilio/SendGrid
                        message: sosMessage,
                    });
                });
            }

            // Notify local emergency services (simulation)
            notifications.push({
                type: 'emergency_services',
                name: 'Local Emergency Services',
                phone: '100',
                status: 'alert_sent',
                location: googleMapsLink,
                message: sosMessage,
            });

            // Log to active trip if provided
            if (tripId) {
                try {
                    await Trip.findOneAndUpdate(
                        { _id: tripId, user: user._id },
                        { $push: { trackingPoints: { lat, lng, timestamp: new Date() } }, status: 'active' }
                    );
                } catch (_) { }
            }

            res.json({
                success: true,
                alert: {
                    timestamp: new Date().toISOString(),
                    location: { lat, lng, mapsLink: googleMapsLink },
                    message: sosMessage,
                    notifications,
                    contactsNotified: notifications.filter((n) => n.type === 'emergency_contact').length,
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

// @route POST /api/safety/track-location (protected)
// @desc  Update live tracking location for active trip
router.post('/track-location', protect, async (req, res, next) => {
    try {
        const { tripId, lat, lng } = req.body;
        if (!tripId || !lat || !lng)
            return res.status(400).json({ error: 'tripId, lat, and lng are required' });

        const trip = await Trip.findOneAndUpdate(
            { _id: tripId, user: req.user._id },
            { $push: { trackingPoints: { lat, lng, timestamp: new Date() } }, status: 'active' },
            { new: true }
        );

        if (!trip) return res.status(404).json({ error: 'Trip not found' });
        res.json({ success: true, pointsRecorded: trip.trackingPoints.length });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
