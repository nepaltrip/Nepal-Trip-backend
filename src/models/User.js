const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
    name: { type: String, required: [true, 'Name is required'], trim: true },

    // Make mobile sparse so null values don't trigger unique constraints
    mobile: {
        type: String,
        trim: true,
        unique: true,
        sparse: true
    },

    email: {
        type: String, required: [true, 'Email is required'], unique: true, trim: true, lowercase: true,
        validate: [validator.isEmail, 'Please enter a valid email address']
    },

    // Conditionally require password based on auth provider
    password: {
        type: String,
        minlength: 8,
        required: function () { return this.authProvider !== 'google'; },
        validate: {
            validator: function (v) {
                if (this.authProvider === 'google') return true;
                return validator.isStrongPassword(v);
            },
            message: 'Password must contain at least 1 lowercase, 1 uppercase, 1 number, and 1 symbol'
        }
    },

    role: { type: String, enum: ['User', 'Admin', 'SuperAdmin'], default: 'User' },
    refreshTokens: [{ type: String }],

    // --- NEW GOOGLE AUTH FIELDS ---
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, unique: true, sparse: true },
    profilePic: { type: String, default: null },

    viewedGalleryItems: [{
        mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'GalleryItem' },
        count: { type: Number, default: 1 },
        lastViewedAt: { type: Date, default: Date.now }
    }],

    crmActivity: [{
        packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
        packageName: String,
        category: String,

        // Exact Time Buckets (in seconds)
        timeSpentOutside: { type: Number, default: 0 },
        timeSpentGold: { type: Number, default: 0 },
        timeSpentPlatinum: { type: Number, default: 0 },

        totalClicks: { type: Number, default: 0 },
        lastActiveAt: { type: Date, default: Date.now },

        // Rolling 7-Day History Log
        recentLogs: [{
            timestamp: { type: Date, default: Date.now },
            durationAdded: Number,
            actionType: String,
            tier: { type: String, enum: ['Gold', 'Platinum', 'None'], default: 'None' } // Explicit tier for aggregations
        }]
    }],
    status: {
        type: String,
        enum: ['active', 'banned'],
        default: 'active'
    },
    lastSeenAt: { type: Date, default: null },
    isOnline: { type: Boolean, default: false },
    topVibe: { type: String, default: "None" },
    mostViewedPackageName: { type: String, default: "None" },
    totalPackageVisits: { type: Number, default: 0 },

    // --- EXISTING FIELDS ---
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    },
    state: { type: String, default: null },
    district: { type: String, default: null },
    lastLocationFetch: { type: Date, default: null },
    pushSubscription: { type: Object, default: null }
}, { timestamps: true });

userSchema.index({ location: '2dsphere' });

userSchema.pre('save', async function () { // 1. Remove 'next' parameter
    // Skip hashing if it's a Google user or password isn't modified
    if (!this.isModified('password') || this.authProvider === 'google') {
        return; // 2. Just return to exit the function
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    // 3. No need to call next() at the end! Mongoose knows it's done when the async function finishes.
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    if (this.authProvider === 'google' && !this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;