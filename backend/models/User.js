const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    roll: { type: String, required: true },    // Add this
    branch: { type: String, required: true }  // Add this
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);