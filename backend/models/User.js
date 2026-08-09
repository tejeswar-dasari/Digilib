const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },

    // DigiLib education context
    educationLevel: {
        type: String,
        enum: ['School', 'Intermediate', 'Diploma', 'B.Tech'],
        default: 'B.Tech'
    },

    // Kept optional because school/inter users may not have an engineering roll number.
    roll: {
        type: String,
        trim: true,
        default: ''
    },

    // B.Tech / Diploma branch, or an optional branch supplied by another course.
    branch: {
        type: String,
        trim: true,
        default: ''
    },

    // School class, e.g. Class 6; Intermediate stream, e.g. MPC.
    schoolClass: {
        type: String,
        trim: true,
        default: ''
    },
    stream: {
        type: String,
        trim: true,
        default: ''
    },

    // Optional institution/course information.
    course: {
        type: String,
        trim: true,
        default: ''
    },
    collegeName: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
