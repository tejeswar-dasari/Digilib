require('dotenv').config(); // Corrected the capital 'R' to lowercase 'r' to prevent runtime crash

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Resource = require('./models/Resource');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const app = express();

// Enable Cross-Origin Resource Sharing (CORS) for all routes
app.use(cors());

// Parse incoming JSON payloads
app.use(express.json());

// Auto-create 'uploads' directory if it doesn't exist to prevent Multer from crashing
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend assets statically (optional, if hosting from the same server)
app.use(express.static(path.join(__dirname, "../frontend")));

// MongoDB Atlas Connection String
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000 // 5 seconds timeout limit
})
.then(() => console.log('MongoDB Connected successfully to database: digilib'))
.catch(err => {
    console.error('MongoDB Connection Error! Check your MongoDB Atlas IP Whitelist (allow access from anywhere: 0.0.0.0/0). Details:');
    console.error(err.message);
});

// Multer Storage Configuration for study materials & question papers
const cloudinary = require("./config/cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "digilib_resources",
    resource_type: "raw",
    use_filename: true,
    unique_filename: false
  }),
});
const upload = multer({ storage });
// API Health Check
app.get('/test', (req, res) => {
    res.json({
        message: 'API Working Successfully'
    });
});

// GET ALL RESOURCES
app.get('/resources', async (req, res) => {
    try {
        // Check database connection state before querying
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: 'Database connection is temporarily offline.' });
        }
        // Fetch resources sorted by most recent first
        const resources = await Resource.find().sort({ createdAt: -1 });
        res.json(resources);
    } catch (error) {
        res.status(500).json({
            message: 'Error fetching resources',
            error: error.message
        });
    }
});

// ADD NEW RESOURCE
app.post('/resources', upload.single('file'), async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: 'Database is offline. Unable to save resource.' });
        }

        // Check if file was uploaded or url was provided
        let resourceUrl = req.body.url;
        let cleanFileName = "";

        if (req.file) {
    console.log("Uploaded File Details:");
    console.log(req.file);

    resourceUrl = req.file.path;
    cleanFileName = req.file.originalname;
}

        const resourceData = {
            name: req.body.name,
            type: req.body.type,
            branch: req.body.branch,
            regulation: req.body.regulation,
            year: req.body.year,
            semester: req.body.semester,
            format: req.body.format,
            url: resourceUrl,
            fileName: cleanFileName,
            clicks: 0
        };

        const resource = new Resource(resourceData);
        const savedResource = await resource.save();

        // Respond with the newly created resource object (required for frontend UI updates)
        res.status(201).json(savedResource);
    } catch (error) {
        console.error("Save Resource Error:", error);
        res.status(500).json({
            message: 'Failed to add resource',
            error: error.message
        });
    }
});

// INCREMENT CLICK/VIEW COUNT
app.patch('/resources/:id/click', async (req, res) => {
    try {
        const { id } = req.params;

        // Skip operations if ID belongs to simulated offline local components
        if (id.startsWith('local-')) {
            return res.status(200).json({ message: 'Local click incremented' });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid Resource ID format' });
        }

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: 'Database connection offline' });
        }

        const updatedResource = await Resource.findByIdAndUpdate(
            id,
            { $inc: { clicks: 1 } },
            { new: true } // returns the modified document rather than original
        );

        if (!updatedResource) {
            return res.status(404).json({ message: 'Resource not found' });
        }

        res.json(updatedResource);
    } catch (error) {
        console.error("Click Increment Error:", error);
        res.status(500).json({
            message: 'Failed to update clicks',
            error: error.message
        });
    }
});

// DELETE RESOURCE
app.delete('/resources/:id', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: 'Database connection offline' });
        }

        const resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({
                message: 'Resource not found'
            });
        }


        await Resource.findByIdAndDelete(req.params.id);

        res.json({
            message: 'Resource deleted successfully'
        });

    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({
            message: 'Failed to delete resource',
            error: error.message
        });
    }
});

// STUDENT SIGNUP
app.post('/signup', async (req, res) => {
    try {
        // Corrected: Extracted roll and branch from request body
        const { name, email, password, roll, branch } = req.body;

        // Ensure variables are captured cleanly
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Missing required parameters (name, email, or password).' });
        }

        // Verify Mongoose connectivity
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ 
                message: 'Database connection is offline. Please ensure your IP address is whitelisted in MongoDB Atlas settings.' 
            });
        }

        // Check existing user
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                message: 'An account with this email address already exists.'
            });
        }

        // Encrypt password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user with roll and branch properties
        const user = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            roll: roll || "STU-OFFLINE",
            branch: branch || "Computer Science (CSE)"
        });

        await user.save();

        res.status(201).json({
            message: 'Signup successful',
            user: {
                name: user.name,
                email: user.email,
                roll: user.roll,
                branch: user.branch
            }
        });
    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({
            message: 'Signup failed',
            error: error.message
        });
    }
});

// STUDENT LOGIN
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        // Verify Mongoose connectivity
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ 
                message: 'Database connection is offline. Please ensure your IP address is whitelisted in MongoDB Atlas settings.' 
            });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(400).json({
                message: 'No account found with this email address.'
            });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                message: 'Incorrect password. Please try again.'
            });
        }

        // Corrected: Returned roll and branch to sync with the frontend's profile layout properly
        res.status(200).json({
            message: 'Login successful',
            user: {
                name: user.name,
                email: user.email,
                roll: user.roll || "STU-OFFLINE",
                branch: user.branch || "Computer Science (CSE)"
            }
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({
            message: 'Login failed',
            error: error.message
        });
    }
});
app.get('/download/:id', async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({
                message: 'Resource not found'
            });
        }

        const fileName = resource.fileName || "download.pdf";

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${fileName}"`
        );

        res.redirect(resource.url);

    } catch (error) {
        console.error("Download Error:", error);
        res.status(500).json({
            message: "Download failed"
        });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running successfully on port ${PORT}`);
});

// Model definition for Requests
const RequestSchema = new mongoose.Schema({
    studentName: { type: String, required: true },
    branch: { type: String, required: true },
    resourceTitle: { type: String, required: true },
    details: { type: String },
    createdAt: { type: Date, default: Date.now }
});
const RequestModel = mongoose.model('Request', RequestSchema);

// --- API ENDPOINTS FOR REQUESTS ---

// 1. GET ALL PENDING REQUESTS
app.get('/requests', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: 'Database connection offline' });
        }
        const requests = await RequestModel.find().sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching requests', error: error.message });
    }
});

// 2. SUBMIT A NEW RESOURCE REQUEST
app.post('/requests', async (req, res) => {
    try {
        const { studentName, branch, resourceTitle, details } = req.body;
        if (!studentName || !branch || !resourceTitle) {
            return res.status(400).json({ message: 'Missing required request fields' });
        }
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: 'Database offline' });
        }

        const newRequest = new RequestModel({ studentName, branch, resourceTitle, details });
        const savedRequest = await newRequest.save();
        res.status(201).json(savedRequest);
    } catch (error) {
        res.status(500).json({ message: 'Failed to post request', error: error.message });
    }
});

// 3. DELETE/RESOLVE REQUEST (When someone fulfills it)
app.delete('/requests/:id', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: 'Database offline' });
        }
        await RequestModel.findByIdAndDelete(req.params.id);
        res.json({ message: 'Request resolved and removed successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete request', error: error.message });
    }
});