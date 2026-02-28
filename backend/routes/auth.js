const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// @route POST /api/auth/register
router.post(
    '/register',
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty())
                return res.status(400).json({ error: errors.array()[0].msg });

            const { name, email, password } = req.body;
            const exists = await User.findOne({ email });
            if (exists) return res.status(400).json({ error: 'Email already registered' });

            const user = await User.create({ name, email, password });
            const token = signToken(user._id);

            res.status(201).json({
                token,
                user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar },
            });
        } catch (err) {
            next(err);
        }
    }
);

// @route POST /api/auth/login
router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Valid email required'),
        body('password').notEmpty().withMessage('Password is required'),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty())
                return res.status(400).json({ error: errors.array()[0].msg });

            const { email, password } = req.body;
            const user = await User.findOne({ email }).select('+password');
            if (!user || !user.password)
                return res.status(401).json({ error: 'Invalid email or password' });

            const isMatch = await user.comparePassword(password);
            if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

            const token = signToken(user._id);
            res.json({
                token,
                user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar },
            });
        } catch (err) {
            next(err);
        }
    }
);

// @route GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// @route GET /api/auth/google/callback
router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/auth/login?error=google_failed` }),
    (req, res) => {
        const token = signToken(req.user._id);
        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    }
);

// @route GET /api/auth/me
router.get('/me', protect, async (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
