const mongoose = require('mongoose');

const ResourceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        default: "BTech",
        trim: true,
        index: true // Optimized index for category-level lookups (School, Intermediate, Diploma, Books & Novels, BTech)
    },
    classLevel: {
        type: String,
        default: "",
        trim: true,
        index: true // e.g. "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"
    },
    stream: {
        type: String,
        default: "",
        trim: true,
        index: true // e.g. "MPC", "BiPC", "CEC", "MEC", "HEC"
    },
    branch: {
        type: String,
        default: "Computer Science (CSE)",
        trim: true,
        index: true
    },
    year: {
        type: String,
        default: "1st Year",
        trim: true,
        index: true
    },
    semester: {
        type: String,
        default: "1st Semester",
        trim: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        trim: true,
        index: true // e.g. "Notes", "Previous Year Papers", "Study Materials", "Websites", "YouTube Links", "Websites & YouTube Links"
    },
    genre: {
        type: String,
        default: "",
        trim: true,
        index: true // e.g. "Programming Books", "Engineering Books", "Novels", "Motivational Books", "Competitive Exam Books", "Psychology", "Finance"
    },
    subject: {
        type: String,
        default: "",
        trim: true
    },
    format: {
        type: String,
        default: "PDF Document",
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
    },
    contributedBy: {
        userId: { type: String, default: '' },
        email: { type: String, default: '', trim: true, lowercase: true },
        name: { type: String, default: '', trim: true }
    }
}, { timestamps: true });

ResourceSchema.index({ 'contributedBy.userId': 1, createdAt: -1 });
ResourceSchema.index({ 'contributedBy.email': 1, createdAt: -1 });

// Compound & Text indexes for optimal performance and sub-second filtering speeds
ResourceSchema.index({ category: 1, createdAt: -1 });
ResourceSchema.index({ category: 1, classLevel: 1, type: 1 });
ResourceSchema.index({ category: 1, stream: 1, year: 1, type: 1 });
ResourceSchema.index({ category: 1, branch: 1, year: 1, semester: 1, type: 1 });
ResourceSchema.index({ category: 1, genre: 1 });
ResourceSchema.index({ name: 'text', subject: 'text', fileName: 'text' });

module.exports = mongoose.model('Resource', ResourceSchema);
