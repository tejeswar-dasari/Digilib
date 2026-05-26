const mongoose = require('mongoose');

const ResourceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['Websites & YouTube Links', 'Previous Year Papers', 'Study Materials']
    },
    branch: {
        type: String,
        required: true
    },
    year: {
        type: String,
        required: true
    },
    semester: {
        type: String,
        required: true
    },
    format: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    fileName: {
        type: String,
        default: ""
    },
    clicks: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Resource', ResourceSchema);