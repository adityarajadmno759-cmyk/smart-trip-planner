const mongoose = require('mongoose');

const TripSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        origin: {
            name: String,
            lat: Number,
            lng: Number,
        },
        destination: {
            name: String,
            lat: Number,
            lng: Number,
        },
        routes: [
            {
                mode: String,
                distance: { value: Number, text: String },
                duration: { value: Number, text: String },
                polyline: String,
                steps: Array,
            },
        ],
        selectedMode: String,
        estimatedCost: {
            fuel: Number,
            transport: Number,
        },
        pollutionScore: {
            aqi: Number,
            category: String,
            dominantPollutant: String,
        },
        status: {
            type: String,
            enum: ['planned', 'active', 'completed', 'cancelled'],
            default: 'planned',
        },
        trackingPoints: [
            {
                lat: Number,
                lng: Number,
                timestamp: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Trip', TripSchema);
