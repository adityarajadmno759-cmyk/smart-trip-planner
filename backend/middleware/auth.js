const passport = require('passport');

const protect = (req, res, next) => {
    passport.authenticate('jwt', { session: false }, (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized. Please log in to access this resource.',
            });
        }
        req.user = user;
        next();
    })(req, res, next);
};

module.exports = { protect };
