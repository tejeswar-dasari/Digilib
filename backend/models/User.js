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
    roll: {
        type: String,
        required: true,
        trim: true
    },
    branch: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['student', 'admin'],
        default: 'student',
        index: true
    },
    educationLevel: {
        type: String,
        default: '',
        trim: true
    },
    schoolClass: {
        type: String,
        default: '',
        trim: true
    },
    stream: {
        type: String,
        default: '',
        trim: true
    },
    course: {
        type: String,
        default: '',
        trim: true
    },
    collegeName: {
        type: String,
        default: '',
        trim: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
