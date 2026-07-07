const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please enter a valid email address']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters long'], // Updated to match strong password rules
        validate: [validator.isStrongPassword, 'Password must contain at least 1 lowercase, 1 uppercase, 1 number, and 1 symbol']
    },
    role: {
        type: String,
        enum: ['User', 'Admin', 'SuperAdmin'],
        default: 'User'
    },
    refreshTokens: [{
        type: String
    }]
}, {
    timestamps: true
});

// ==========================================
// PRE-SAVE HOOK: Password Hashing Middleware
// ==========================================
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// ==========================================
// INSTANCE METHOD: Password Verification
// ==========================================
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;