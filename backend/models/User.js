const mongoose = require('mongoose'); // Corrected Capital 'C' in 'Const' to prevent fatal crashes

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
        lowercase: true, // Auto-converts email strings to lowercase in the database
        trim: true // Cleans up any accidental whitespaces
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
    }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('User', UserSchema); // Cleaned up the double assignment export typo