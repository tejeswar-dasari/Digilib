require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const bcrypt = require('bcryptjs');
const axios = require('axios');

const Resource = require('./models/Resource');
const User = require('./models/User');

const app = express();

app.use(cors());
app.use(compression());
app.use(express.json());

// Auto-create 'uploads' directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir, {
    maxAge: '7d',
    immutable: true
}));

// Serve frontend assets statically
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Multer Storage Configuration
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
});

let storage = diskStorage;
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    try {
        const cloudinary = require("./config/cloudinary");
        const { CloudinaryStorage } = require("multer-storage-cloudinary");
        storage = new CloudinaryStorage({
            cloudinary,
            params: async (req, file) => ({
                folder: "digilib_resources",
                resource_type: "raw",
                access_mode: "public",
                use_filename: true,
                unique_filename: false
            }),
        });
    } catch (e) {
        console.warn("Cloudinary init warning, using disk storage fallback:", e.message);
    }
}
const upload = multer({ storage });

// MongoDB Connection
mongoose.set('bufferCommands', false);
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
    mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000
    })
    .then(() => console.log('MongoDB Connected successfully to database: digilib'))
    .catch(err => {
        console.warn('MongoDB Connection Warning:', err.message);
        console.warn('App operating with in-memory store fallback.');
    });
} else {
    console.log('No MONGO_URI provided. Operating with in-memory store fallback.');
}

// In-Memory Fallback Data Store with rich sample data for all modules
let memoryResources = [
    // BTech Existing Resources
    {
        _id: "local-res-1",
        name: "BEEE Unit-V R23 Notes",
        category: "BTech",
        type: "Study Materials",
        branch: "Computer Science (CSE)",
        year: "1st Year",
        semester: "1st Semester",
        format: "PDF Document",
        url: "uploads/1779782707522-BEEE_UNIT-V_R23_NOTES.pdf",
        fileName: "BEEE_UNIT-V_R23_NOTES.pdf",
        clicks: 24,
        createdAt: new Date()
    },
    {
        _id: "local-res-2",
        name: "1st Year Mid 2 Previous Question Papers",
        category: "BTech",
        type: "Previous Year Papers",
        branch: "Computer Science (CSE)",
        year: "1st Year",
        semester: "1st Semester",
        format: "PDF Document",
        url: "uploads/1779782816490-mid_2_1st_year.pdf",
        fileName: "mid_2_1st_year.pdf",
        clicks: 42,
        createdAt: new Date()
    },
    {
        _id: "local-res-3",
        name: "Data Structures & Algorithms Course",
        category: "BTech",
        type: "Websites & YouTube Links",
        branch: "Computer Science (CSE)",
        year: "2nd Year",
        semester: "1st Semester",
        format: "YouTube Playlist",
        url: "https://www.youtube.com/playlist?list=PL2_aWCzGMAwI3W_JlcBbtYTwiQSsOTa6P",
        fileName: "",
        clicks: 115,
        createdAt: new Date()
    },
    // School Resources
    {
        _id: "sch-res-1",
        name: "Class 8 Mathematics Mensuration & Geometry Complete Notes",
        category: "School",
        classLevel: "Class 8",
        type: "Notes",
        format: "PDF Document",
        url: "https://www.ncert.nic.in/",
        fileName: "Class8_Maths_Notes.pdf",
        clicks: 35,
        createdAt: new Date()
    },
    {
        _id: "sch-res-2",
        name: "Class 8 Physics Sound & Light Motion Study Guide",
        category: "School",
        classLevel: "Class 8",
        type: "Study Materials",
        format: "PDF Document",
        url: "https://www.ncert.nic.in/",
        fileName: "Class8_Physics_StudyGuide.pdf",
        clicks: 18,
        createdAt: new Date()
    },
    {
        _id: "sch-res-3",
        name: "Class 10 Science Board Exam Previous Year Question Paper 2024",
        category: "School",
        classLevel: "Class 10",
        type: "Previous Year Papers",
        format: "PDF Document",
        url: "https://cbse.gov.in/",
        fileName: "Class10_Science_PYQ_2024.pdf",
        clicks: 89,
        createdAt: new Date()
    },
    {
        _id: "sch-res-4",
        name: "Khan Academy Class 9 Mathematics Video Tutorials",
        category: "School",
        classLevel: "Class 9",
        type: "YouTube Links",
        format: "YouTube Playlist",
        url: "https://www.youtube.com/user/khanacademy",
        fileName: "",
        clicks: 52,
        createdAt: new Date()
    },
    // Intermediate Resources
    {
        _id: "inter-res-1",
        name: "Inter 1st Year MPC Physics Formulas & Revision Notes",
        category: "Intermediate",
        stream: "MPC",
        year: "1st Year",
        type: "Notes",
        format: "PDF Document",
        url: "https://bie.ap.gov.in/",
        fileName: "Inter1_MPC_Physics_Notes.pdf",
        clicks: 64,
        createdAt: new Date()
    },
    {
        _id: "inter-res-2",
        name: "Inter 2nd Year MPC Chemistry Previous Year Board Papers",
        category: "Intermediate",
        stream: "MPC",
        year: "2nd Year",
        type: "Previous Year Papers",
        format: "PDF Document",
        url: "https://bie.ap.gov.in/",
        fileName: "Inter2_Chemistry_PYQ.pdf",
        clicks: 77,
        createdAt: new Date()
    },
    {
        _id: "inter-res-3",
        name: "BiPC Zoology & Human Anatomy Diagrams Study Material",
        category: "Intermediate",
        stream: "BiPC",
        year: "1st Year",
        type: "Study Materials",
        format: "PDF Document",
        url: "https://bie.ap.gov.in/",
        fileName: "BiPC_Zoology_Diagrams.pdf",
        clicks: 41,
        createdAt: new Date()
    },
    // Diploma Resources
    {
        _id: "dip-res-1",
        name: "Diploma CSE C Programming & Logic Notes",
        category: "Diploma",
        branch: "Computer Science (CSE)",
        year: "1st Year",
        type: "Notes",
        format: "PDF Document",
        url: "https://sbtet.ap.gov.in/",
        fileName: "Diploma_CSE_C_Notes.pdf",
        clicks: 56,
        createdAt: new Date()
    },
    {
        _id: "dip-res-2",
        name: "Diploma ECE Circuit Theory Previous Question Papers",
        category: "Diploma",
        branch: "Electronics & Communication (ECE)",
        year: "2nd Year",
        type: "Previous Year Papers",
        format: "PDF Document",
        url: "https://sbtet.ap.gov.in/",
        fileName: "Diploma_ECE_Circuits_PYQ.pdf",
        clicks: 39,
        createdAt: new Date()
    },
    // Books & Novels Resources
    {
        _id: "book-res-1",
        name: "Clean Code: A Handbook of Agile Software Craftsmanship",
        category: "Books & Novels",
        genre: "Programming Books",
        format: "PDF Document",
        url: "https://www.google.com/books",
        fileName: "Clean_Code_Robert_Martin.pdf",
        clicks: 142,
        createdAt: new Date()
    },
    {
        _id: "book-res-2",
        name: "Atomic Habits by James Clear",
        category: "Books & Novels",
        genre: "Motivational Books",
        format: "PDF Document",
        url: "https://www.google.com/books",
        fileName: "Atomic_Habits_James_Clear.pdf",
        clicks: 210,
        createdAt: new Date()
    },
    {
        _id: "book-res-3",
        name: "The Psychology of Money by Morgan Housel",
        category: "Books & Novels",
        genre: "Finance",
        format: "PDF Document",
        url: "https://www.google.com/books",
        fileName: "Psychology_of_Money.pdf",
        clicks: 185,
        createdAt: new Date()
    },
    {
        _id: "book-res-4",
        name: "Higher Engineering Mathematics by B.S. Grewal",
        category: "Books & Novels",
        genre: "Engineering Books",
        format: "PDF Document",
        url: "https://www.google.com/books",
        fileName: "BS_Grewal_Engineering_Mathematics.pdf",
        clicks: 130,
        createdAt: new Date()
    }
];

let memoryUsers = [];

let memoryRequests = [
    {
        _id: "req-local-1",
        studentName: "TEJESWAR",
        branch: "Computer Science (CSE)",
        resourceTitle: "Discrete Mathematics Graph Theory Spanning Tree Notes",
        details: "Urgent need for internal exam prep!",
        createdAt: new Date()
    }
];

// Request Model Definition for Mongoose
const RequestSchema = new mongoose.Schema({
    studentName: { type: String, required: true },
    branch: { type: String, required: true },
    resourceTitle: { type: String, required: true },
    details: { type: String },
    createdAt: { type: Date, default: Date.now }
});
const RequestModel = mongoose.model('Request', RequestSchema);

// API Health Check
app.get('/test', (req, res) => {
    res.json({ message: 'API Working Successfully' });
});

// ADMIN AUTHENTICATION ENDPOINT
app.post('/admin-login', (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }

        const masterKeys = [
            process.env.ADMIN_PASSWORD || "Tejeswar2709",
            "Tejessen45"
        ];

        if (masterKeys.includes(password.trim())) {
            return res.status(200).json({ success: true, message: 'Admin authentication verified successfully' });
        }

        return res.status(401).json({ success: false, message: 'Wrong credentials. Verification failed.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Authentication error' });
    }
});

// GET RESOURCES (Supports full query parameters and filtering optimization)
app.get('/resources', async (req, res) => {
    try {
        const { category, classLevel, stream, branch, year, semester, type, genre } = req.query;

        let query = {};
        if (category) query.category = category;
        if (classLevel) query.classLevel = classLevel;
        if (stream) query.stream = stream;
        if (branch) query.branch = branch;
        if (year) query.year = year;
        if (semester) query.semester = semester;
        if (type && type !== 'All') query.type = type;
        if (genre) query.genre = genre;

        if (mongoose.connection.readyState === 1) {
            const resources = await Resource.find(query).sort({ createdAt: -1 }).lean();
            return res.json(resources);
        }

        // Memory array filtering fallback
        let filteredMemory = memoryResources.filter(item => {
            if (category && item.category !== category) return false;
            if (classLevel && item.classLevel !== classLevel) return false;
            if (stream && item.stream !== stream) return false;
            if (branch && item.branch !== branch) return false;
            if (year && item.year !== year) return false;
            if (semester && item.semester !== semester) return false;
            if (type && type !== 'All' && item.type !== type) return false;
            if (genre && item.genre !== genre) return false;
            return true;
        });

        res.json(filteredMemory);
    } catch (error) {
        res.json(memoryResources);
    }
});

// DOWNLOAD / GET RESOURCE FILE
app.get('/download/:id', async (req, res) => {
    try {
        let resource = null;
        if (mongoose.connection.readyState === 1) {
            try {
                resource = await Resource.findById(req.params.id);
            } catch (e) {
                // Ignore ObjectId casting error for local IDs
            }
        }
        if (!resource) {
            resource = memoryResources.find(r => r._id === req.params.id || r.id === req.params.id);
        }

        if (!resource) {
            return res.status(404).send('Resource not found');
        }

        // Check if resource URL is a local file path
        const isLocalFile = resource.url && !resource.url.startsWith('http://') && !resource.url.startsWith('https://');
        if (isLocalFile) {
            const filePath = path.isAbsolute(resource.url) ? resource.url : path.join(__dirname, resource.url);
            if (fs.existsSync(filePath)) {
                return res.download(filePath, resource.fileName || path.basename(filePath));
            }
        }

        // External URL download stream
        if (resource.url && resource.url.startsWith('http')) {
            const response = await axios({
                url: resource.url,
                method: 'GET',
                responseType: 'stream'
            });

            res.setHeader('Content-Disposition', `attachment; filename="${resource.fileName || 'document.pdf'}"`);
            res.setHeader('Content-Type', 'application/pdf');
            return response.data.pipe(res);
        }

        res.status(404).send('File unavailable');
    } catch (error) {
        console.error("Download Error:", error.message);
        res.status(500).send('Download failed');
    }
});

// ADD NEW RESOURCE
app.post('/resources', upload.single('file'), async (req, res) => {
    try {
        let resourceUrl = req.body.url || "#";
        let cleanFileName = "";

        if (req.file) {
            resourceUrl = req.file.path ? (req.file.path.startsWith('http') ? req.file.path : `uploads/${req.file.filename}`) : `uploads/${req.file.filename}`;
            cleanFileName = req.file.originalname;
        }

        const resourceData = {
            name: req.body.name,
            category: req.body.category || "BTech",
            classLevel: req.body.classLevel || req.body.class || "",
            stream: req.body.stream || "",
            branch: req.body.branch || "",
            year: req.body.year || "",
            semester: req.body.semester || "",
            type: req.body.type || req.body.resourceType || "Study Materials",
            genre: req.body.genre || "",
            subject: req.body.subject || "",
            format: req.body.format || "PDF Document",
            url: resourceUrl,
            fileName: cleanFileName,
            clicks: 0
        };

        if (mongoose.connection.readyState === 1) {
            const resource = new Resource(resourceData);
            const savedResource = await resource.save();
            return res.status(201).json(savedResource);
        }

        // In-memory fallback
        const savedResource = {
            ...resourceData,
            _id: `local-res-${Date.now()}`,
            createdAt: new Date()
        };
        memoryResources.unshift(savedResource);
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

        if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
            const updatedResource = await Resource.findByIdAndUpdate(
                id,
                { $inc: { clicks: 1 } },
                { new: true }
            );
            if (updatedResource) {
                return res.json(updatedResource);
            }
        }

        // In-memory fallback
        const target = memoryResources.find(r => r._id === id || r.id === id);
        if (target) {
            target.clicks = (target.clicks || 0) + 1;
            return res.json(target);
        }

        res.json({ message: 'Click updated' });
    } catch (error) {
        res.json({ message: 'Click updated' });
    }
});

// DELETE RESOURCE
app.delete('/resources/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
            await Resource.findByIdAndDelete(id);
            return res.json({ message: 'Resource deleted successfully' });
        }

        // In-memory fallback
        memoryResources = memoryResources.filter(r => r._id !== id && r.id !== id);
        res.json({ message: 'Resource deleted successfully' });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ message: 'Failed to delete resource', error: error.message });
    }
});

// STUDENT SIGNUP
app.post('/signup', async (req, res) => {
    try {
        const { name, email, password, roll, branch } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Missing required parameters (name, email, or password).' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        if (mongoose.connection.readyState === 1) {
            const existingUser = await User.findOne({ email: normalizedEmail });
            if (existingUser) {
                return res.status(400).json({ message: 'An account with this email address already exists.' });
            }
            if (roll) {
                const existingRoll = await User.findOne({ roll });
                if (existingRoll) {
                    return res.status(400).json({ message: 'This Roll Number is already registered.' });
                }
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const user = new User({
                name,
                email: normalizedEmail,
                password: hashedPassword,
                roll: roll || "STU-OFFLINE",
                branch: branch || "Computer Science (CSE)"
            });
            await user.save();

            return res.status(201).json({
                message: 'Signup successful',
                user: { name: user.name, email: user.email, roll: user.roll, branch: user.branch }
            });
        }

        // In-memory fallback
        const existingInMemory = memoryUsers.find(u => u.email === normalizedEmail || (roll && u.roll === roll));
        if (existingInMemory) {
            return res.status(400).json({ message: 'Account or Roll Number already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            _id: `user-${Date.now()}`,
            name,
            email: normalizedEmail,
            password: hashedPassword,
            roll: roll || "STU-OFFLINE",
            branch: branch || "Computer Science (CSE)"
        };
        memoryUsers.push(newUser);

        res.status(201).json({
            message: 'Signup successful',
            user: { name: newUser.name, email: newUser.email, roll: newUser.roll, branch: newUser.branch }
        });
    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ message: 'Signup failed', error: error.message });
    }
});

// STUDENT LOGIN
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        if (mongoose.connection.readyState === 1) {
            const user = await User.findOne({ email: normalizedEmail });
            if (!user) {
                return res.status(400).json({ message: 'No account found with this email address.' });
            }
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Incorrect password. Please try again.' });
            }
            return res.status(200).json({
                message: 'Login successful',
                user: { name: user.name, email: user.email, roll: user.roll || "STU-OFFLINE", branch: user.branch || "Computer Science (CSE)" }
            });
        }

        // In-memory fallback
        const user = memoryUsers.find(u => u.email === normalizedEmail);
        if (!user) {
            return res.status(400).json({ message: 'No account found with this email address.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect password. Please try again.' });
        }

        res.status(200).json({
            message: 'Login successful',
            user: { name: user.name, email: user.email, roll: user.roll, branch: user.branch }
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Login failed', error: error.message });
    }
});

// RESET / FORGOT PASSWORD
app.post('/reset-password', async (req, res) => {
    try {
        const { email, password, newPassword, roll } = req.body;
        const targetPassword = newPassword || password;

        if (!email || !targetPassword) {
            return res.status(400).json({ message: 'Email address and new password are required.' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        if (mongoose.connection.readyState === 1) {
            const query = { email: normalizedEmail };
            if (roll) query.roll = roll.trim();

            const user = await User.findOne(query);
            if (!user) {
                return res.status(404).json({ message: 'No account found matching the provided email address.' });
            }

            const hashedPassword = await bcrypt.hash(targetPassword, 10);
            user.password = hashedPassword;
            await user.save();

            return res.status(200).json({ message: 'Password updated successfully! You can now log in with your new password.' });
        }

        // In-memory fallback
        const user = memoryUsers.find(u => u.email === normalizedEmail && (!roll || u.roll.toLowerCase() === roll.trim().toLowerCase()));
        if (!user) {
            return res.status(404).json({ message: 'No account found matching the provided email address.' });
        }

        const hashedPassword = await bcrypt.hash(targetPassword, 10);
        user.password = hashedPassword;

        return res.status(200).json({ message: 'Password updated successfully! You can now log in with your new password.' });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: 'Failed to reset password', error: error.message });
    }
});

// GET ALL PENDING REQUESTS
app.get('/requests', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const requests = await RequestModel.find().sort({ createdAt: -1 }).lean();
            return res.json(requests);
        }
        res.json(memoryRequests);
    } catch (error) {
        res.json(memoryRequests);
    }
});

// SUBMIT A NEW RESOURCE REQUEST
app.post('/requests', async (req, res) => {
    try {
        const { studentName, branch, resourceTitle, details } = req.body;
        if (!studentName || !branch || !resourceTitle) {
            return res.status(400).json({ message: 'Missing required request fields' });
        }

        if (mongoose.connection.readyState === 1) {
            const newRequest = new RequestModel({ studentName, branch, resourceTitle, details });
            const savedRequest = await newRequest.save();
            return res.status(201).json(savedRequest);
        }

        // In-memory fallback
        const newRequest = {
            _id: `req-${Date.now()}`,
            studentName,
            branch,
            resourceTitle,
            details: details || "",
            createdAt: new Date()
        };
        memoryRequests.unshift(newRequest);
        res.status(201).json(newRequest);
    } catch (error) {
        res.status(500).json({ message: 'Failed to post request', error: error.message });
    }
});

// DELETE/RESOLVE REQUEST
app.delete('/requests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
            await RequestModel.findByIdAndDelete(id);
            return res.json({ message: 'Request resolved and removed successfully!' });
        }

        // In-memory fallback
        memoryRequests = memoryRequests.filter(r => r._id !== id && r.id !== id);
        res.json({ message: 'Request resolved and removed successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete request', error: error.message });
    }
});

// Catch-all route to serve index.html for SPA / static pages navigation
app.use((req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`DigiLib server running on http://0.0.0.0:${PORT}`);
});
