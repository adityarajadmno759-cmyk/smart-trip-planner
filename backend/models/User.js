const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
        },
        password: {
            type: String,
            minlength: [6, 'Password must be at least 6 characters'],
            select: false,
        },
        googleId: { type: String },
        avatar: { type: String },
        isVerified: { type: Boolean, default: false },
        phone: { type: String },
        emergencyContacts: [
            {
                name: String,
                phone: String,
                email: String,
                relation: String,
            },
        ],
        savedRoutes: [
            {
                origin: Object,
                destination: Object,
                mode: String,
                savedAt: { type: Date, default: Date.now },
            },
        ],
        preferences: {
            defaultMode: { type: String, default: 'driving' },
            currency: { type: String, default: 'INR' },
        },
    },
    { timestamps: true }
);

// Hash password before save
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
