const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        type: {
            type: String,
            enum: ['hotel', 'ride', 'rental', 'ticket'],
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'cancelled', 'completed'],
            default: 'confirmed',
        },
        bookingRef: {
            type: String,
            unique: true,
            default: () => 'STP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        },

        // Hotel booking
        hotel: {
            placeId: String,
            name: String,
            address: String,
            pricePerNight: Number,
            checkIn: Date,
            checkOut: Date,
            rooms: { type: Number, default: 1 },
            totalPrice: Number,
            rating: Number,
            photoUrl: String,
        },

        // Ride booking
        ride: {
            vehicleType: String,
            origin: Object,
            destination: Object,
            estimatedFare: Number,
            estimatedArrival: Number, // minutes
            distance: Number, // km
            driverName: String,
            driverPhone: String,
            plateNumber: String,
        },

        // Rental booking
        rental: {
            vehicleId: String,
            vehicleType: String,
            vehicleName: String,
            pricePerHour: Number,
            pricePerDay: Number,
            startTime: Date,
            endTime: Date,
            totalPrice: Number,
            location: String,
        },

        // Ticket booking
        ticket: {
            placeId: String,
            placeName: String,
            placeAddress: String,
            visitDate: Date,
            timeSlot: String,
            numberOfPersons: { type: Number, default: 1 },
            pricePerPerson: Number,
            totalPrice: Number,
            queueEstimate: Number,
            expectedEntryTime: String,
        },

        paymentMethod: { type: String, default: 'card' },
        paidAmount: Number,
        notes: String,
    },
    { timestamps: true }
);

module.exports = mongoose.model('Booking', BookingSchema);
