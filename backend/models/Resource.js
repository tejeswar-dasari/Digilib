const mongoose = require('mongoose'); // Corrected Capital 'C' in 'Const' to prevent fatal ReferenceError crashes

const ResourceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['Websites & YouTube Links', 'Previous Year Papers', 'Study Materials'],
        index: true // Optimized index for fast service-type tab filtering
    },
    branch: {
        type: String,
        required: true,
        trim: true,
        index: true // Optimized index for active academic profile lookups
    },
    regulation:{
        type: String,
        required: true,
        trim:true,
        index:true
    },
    year: {
        type: String,
        required: true,
        trim: true,
        index: true // Optimized index for year-specific syllabus filtering
    },
    semester: {
        type: String,
        required: true,
        trim: true,
        index: true // Optimized index for semester filtering
    },
    format: {
        type: String,
        required: true,
        trim: true
    },
    url: {
        type: String,
        required: true,
        trim: true
    },
    fileName: {
        type: String,
        default: "",
        trim: true
    },
    clicks: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Resource', ResourceSchema);