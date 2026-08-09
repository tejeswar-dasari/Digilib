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
const crypto = require('crypto');

const Resource = require('./models/Resource');
const User = require('./models/User');

const app = express();

// Lightweight signed session token. No extra JWT dependency is required.
const AUTH_SECRET = String(process.env.AUTH_SECRET || '').trim();
if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
    console.error('AUTH_SECRET must be configured in the backend environment and be at least 32 characters long.');
    process.exit(1);
}
const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function base64UrlEncode(value) {
    return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
    const padded = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value).length / 4) * 4, '=');
    return Buffer.from(padded, 'base64').toString('utf8');
}

function signSession(payload) {
    const body = base64UrlEncode(JSON.stringify(payload));
    const signature = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    return `${body}.${signature}`;
}

function verifySession(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [body, signature] = token.split('.');
    const expected = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const payload = JSON.parse(base64UrlDecode(body));
        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch (_) {
        return null;
    }
}

function createSession(user, roleOverride) {
    return signSession({
        sub: String(user._id || user.email),
        email: String(user.email || '').toLowerCase().trim(),
        role: roleOverride || user.role || 'student',
        name: user.name || '',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + AUTH_TOKEN_TTL_SECONDS
    });
}

function getSession(req) {
    const header = req.headers.authorization || '';
    return verifySession(header.startsWith('Bearer ') ? header.slice(7).trim() : '');
}

function requireAuth(req, res, next) {
    const session = getSession(req);
    if (!session) return res.status(401).json({ message: 'Please log in to perform this action.' });
    req.userSession = session;
    next();
}

function requireAdmin(req, res, next) {
    const session = getSession(req);
    if (!session || session.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' });
    req.userSession = session;
    next();
}

function isAdminUser(user) {
    if (!user) return false;
    const email = String(user.email || '').toLowerCase().trim();
    return user.role === 'admin' ||
        String(user.roll || '').toUpperCase().startsWith('ADMIN-') ||
        String(user.branch || '').toLowerCase() === 'administration';
}

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

function isMongoConnected() {
    return mongoose.connection.readyState === 1;
}

function requireMongo(req, res, next) {
    if (!isMongoConnected()) {
        return res.status(503).json({
            message: 'MongoDB is not connected. Configure MONGO_URI in the deployment environment.'
        });
    }
    next();
}

if (MONGO_URI) {
    mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000
    })
    .then(async () => {
        console.log('MongoDB Connected successfully to database: digilib');
        try {
            const resCount = await Resource.countDocuments();
            if (resCount === 0) {
                console.log('Seeding initial sample resources into MongoDB...');
                await Resource.insertMany(memoryResources.map(r => {
                    const copy = { ...r };
                    delete copy._id;
                    return copy;
                }));
            }
            const userCount = await User.countDocuments();
            if (userCount === 0) {
                console.log('Seeding initial admin users into MongoDB...');
                await User.insertMany(memoryUsers.map(u => {
                    const copy = { ...u };
                    delete copy._id;
                    return copy;
                }));
            }
            invalidateResourceCache();
        } catch (seedErr) {
            console.warn('Auto-seed warning:', seedErr.message);
        }
    })
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
        name: "GeeksforGeeks Data Structures & Algorithms Portal",
        category: "BTech",
        type: "Website Links",
        branch: "Computer Science (CSE)",
        year: "2nd Year",
        semester: "1st Semester",
        format: "Website Link",
        url: "https://www.geeksforgeeks.org/data-structures/",
        fileName: "",
        clicks: 115,
        createdAt: new Date()
    },
    {
        _id: "local-res-4",
        name: "JNTU R23 Computer Science Engineering Official Syllabus Copy",
        category: "BTech",
        type: "Syllabus",
        branch: "Computer Science (CSE)",
        year: "1st Year",
        semester: "1st Semester",
        format: "PDF Document",
        url: "https://jntu.ac.in/",
        fileName: "BTech_CSE_R23_Syllabus.pdf",
        clicks: 74,
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
        name: "Class 10 All Subjects Official Board Syllabus 2024-25",
        category: "School",
        classLevel: "Class 10",
        type: "Syllabus",
        format: "PDF Document",
        url: "https://ncert.nic.in/",
        fileName: "Class10_Syllabus_2024_25.pdf",
        clicks: 61,
        createdAt: new Date()
    },
    {
        _id: "sch-res-5",
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
        type: "Previous Papers",
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
    {
        _id: "inter-res-4",
        name: "BIEAP Intermediate Board Official Complete Syllabus 2024-25",
        category: "Intermediate",
        stream: "MPC",
        year: "1st Year",
        type: "Syllabus",
        format: "PDF Document",
        url: "https://bie.ap.gov.in/",
        fileName: "Inter_BIEAP_Syllabus.pdf",
        clicks: 83,
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

const defaultAdminPassHash = bcrypt.hashSync("Tejeswar2709", 10);
let memoryUsers = [
    {
        _id: "admin-user-1",
        name: "Tejeswar",
        email: "tejeswartejeswar56@gmail.com",
        password: defaultAdminPassHash,
        roll: "ADMIN-001",
        branch: "Computer Science (CSE)",
        role: "admin"
    },
    {
        _id: "admin-user-2",
        name: "System Admin",
        email: "admin@digilib.com",
        password: defaultAdminPassHash,
        roll: "ADMIN-002",
        branch: "Administration",
        role: "admin"
    }
];

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
    studentName: { type: String, required: true, trim: true },
    userEmail: { type: String, default: '', trim: true, lowercase: true, index: true },
    requestedBy: {
        userId: { type: String, default: '' },
        email: { type: String, default: '', trim: true, lowercase: true },
        name: { type: String, default: '', trim: true }
    },
    branch: { type: String, required: true, trim: true },
    resourceTitle: { type: String, required: true, trim: true },
    details: { type: String, default: '', trim: true },
    createdAt: { type: Date, default: Date.now, index: true }
});
RequestSchema.index({ 'requestedBy.userId': 1, createdAt: -1 });
RequestSchema.index({ userEmail: 1, createdAt: -1 });
const RequestModel = mongoose.model('Request', RequestSchema);

// API Health Check
app.get('/test', (req, res) => {
    res.json({ message: 'API Working Successfully' });
});

// Health check used to verify deployment + MongoDB connectivity without exposing secrets.
app.get('/health', (req, res) => {
    const connected = isMongoConnected();
    res.status(connected ? 200 : 503).json({
        ok: connected,
        mongodb: connected ? 'connected' : 'disconnected',
        database: connected ? (mongoose.connection.name || 'connected') : null,
        timestamp: new Date().toISOString()
    });
});

// ADMIN AUTHENTICATION ENDPOINT
// Admin credentials are verified only on the backend. Never put ADMIN_EMAIL,
// ADMIN_PASSWORD, or AUTH_SECRET in frontend code.
app.post('/admin-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = String(email || '').toLowerCase().trim();
        const inputPassword = String(password || '');

        if (!normalizedEmail || !inputPassword) {
            return res.status(400).json({ success: false, message: 'Both Admin Email and Password are required.' });
        }

        const configuredAdminEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
        const configuredAdminPassword = String(process.env.ADMIN_PASSWORD || '');

        if (!configuredAdminEmail || !configuredAdminPassword) {
            return res.status(503).json({
                success: false,
                message: 'Admin credentials are not configured on the backend.'
            });
        }

        // Primary administrator credentials come from Render/backend environment variables.
        // They are never shipped to the browser.
        if (normalizedEmail === configuredAdminEmail && inputPassword === configuredAdminPassword) {
            let adminUser = null;

            if (mongoose.connection.readyState === 1) {
                adminUser = await User.findOne({ email: configuredAdminEmail });

                if (adminUser) {
                    adminUser.name = adminUser.name || 'DigiLib Administrator';
                    adminUser.roll = 'ADMIN-001';
                    adminUser.branch = 'Administration';
                    adminUser.role = 'admin';
                    adminUser.password = await bcrypt.hash(configuredAdminPassword, 12);
                    await adminUser.save();
                } else {
                    adminUser = await User.create({
                        name: 'DigiLib Administrator',
                        email: configuredAdminEmail,
                        password: await bcrypt.hash(configuredAdminPassword, 12),
                        roll: 'ADMIN-001',
                        branch: 'Administration',
                        role: 'admin'
                    });
                }
            }

            if (!adminUser) {
                adminUser = memoryUsers.find(u => u.email === configuredAdminEmail);
                if (!adminUser) {
                    adminUser = {
                        _id: `admin-mem-${Date.now()}`,
                        name: 'DigiLib Administrator',
                        email: configuredAdminEmail,
                        password: await bcrypt.hash(configuredAdminPassword, 12),
                        roll: 'ADMIN-001',
                        branch: 'Administration',
                        role: 'admin'
                    };
                    memoryUsers.push(adminUser);
                }
                adminUser.role = 'admin';
            }

            return res.status(200).json({
                success: true,
                message: 'Administrator credentials verified by backend.',
                token: createSession(adminUser, 'admin'),
                user: {
                    name: adminUser.name,
                    email: adminUser.email,
                    role: 'admin'
                }
            });
        }

        // Legacy/admin accounts stored in MongoDB may also log in, but only when
        // their account is explicitly marked as an administrator.
        let foundUser = null;
        if (mongoose.connection.readyState === 1) {
            foundUser = await User.findOne({ email: normalizedEmail });
        }
        if (!foundUser) {
            foundUser = memoryUsers.find(u => u.email === normalizedEmail);
        }

        if (!foundUser || !isAdminUser(foundUser)) {
            return res.status(401).json({ success: false, message: 'Invalid administrator credentials.' });
        }

        const isMatch = await bcrypt.compare(inputPassword, foundUser.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid administrator credentials.' });
        }

        return res.status(200).json({
            success: true,
            message: 'Administrator account verified by backend.',
            token: createSession(foundUser, 'admin'),
            user: {
                name: foundUser.name,
                email: foundUser.email,
                role: 'admin'
            }
        });
    } catch (error) {
        console.error('Admin Auth Error:', error);
        return res.status(500).json({ success: false, message: 'Server verification error' });
    }
});

// Return the authenticated user's current profile.
// This is used to restore the profile UI after navigation/reload.
app.get('/me', requireAuth, async (req, res) => {
    try {
        const session = req.userSession;
        let user = null;

        if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(session.sub)) {
            user = await User.findById(session.sub).lean();
        }

        if (!user && mongoose.connection.readyState === 1 && session.email) {
            user = await User.findOne({ email: session.email }).lean();
        }

        if (!user) {
            user = memoryUsers.find(u => String(u.email).toLowerCase() === String(session.email).toLowerCase());
        }

        if (!user) {
            return res.status(404).json({ message: 'User profile not found.' });
        }

        return res.json({
            name: user.name || session.name || '',
            email: user.email || session.email || '',
            roll: user.roll || '',
            branch: user.branch || '',
            role: user.role || session.role || 'student',
            educationLevel: user.educationLevel || '',
            schoolClass: user.schoolClass || '',
            stream: user.stream || '',
            course: user.course || '',
            collegeName: user.collegeName || ''
        });
    } catch (error) {
        console.error('GET /me error:', error.message);
        return res.status(500).json({ message: 'Failed to load profile.' });
    }
});

// Server In-Memory Cache for Lightning-Fast Resource Queries (< 1ms responses)
const resourceApiCache = new Map();
const RESOURCE_CACHE_TTL = 30000; // 30s cache TTL

function getCachedResources(key) {
    const cached = resourceApiCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > RESOURCE_CACHE_TTL) {
        resourceApiCache.delete(key);
        return null;
    }
    return cached.data;
}

function setCachedResources(key, data) {
    resourceApiCache.set(key, { data, timestamp: Date.now() });
}

function invalidateResourceCache() {
    resourceApiCache.clear();
}

function escapeRegex(text) {
    if (!text) return '';
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// GET RESOURCES (Supports full query parameters, query caching, and index projection)
app.get('/resources', async (req, res) => {
    try {
        const cacheKey = JSON.stringify(req.query);
        const cachedResult = getCachedResources(cacheKey);
        if (cachedResult) {
            res.setHeader('X-Cache', 'HIT');
            res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
            return res.json(cachedResult);
        }

        const { category, classLevel, stream, branch, year, semester, type, genre } = req.query;

        let query = {};
        if (category) query.category = { $regex: `^${escapeRegex(category)}$`, $options: 'i' };
        if (classLevel) query.classLevel = { $regex: `^${escapeRegex(classLevel)}$`, $options: 'i' };
        if (stream) query.stream = { $regex: `^${escapeRegex(stream)}$`, $options: 'i' };
        if (branch) query.branch = { $regex: escapeRegex(branch), $options: 'i' };
        if (year) query.year = { $regex: escapeRegex(year), $options: 'i' };
        if (semester) query.semester = { $regex: escapeRegex(semester), $options: 'i' };
        if (type && type !== 'All') query.type = { $regex: escapeRegex(type), $options: 'i' };
        if (genre) query.genre = { $regex: escapeRegex(genre), $options: 'i' };

        if (!isMongoConnected()) {
            return res.status(503).json({
                message: 'MongoDB is not connected. Configure MONGO_URI in the deployment environment.'
            });
        }

        const result = await Resource.find(query)
            .select('_id name category classLevel stream branch year semester type genre subject format url fileName clicks createdAt')
            .sort({ createdAt: -1 })
            .lean();
        setCachedResources(cacheKey, result);

        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
        res.json(result);
    } catch (error) {
        console.error('GET /resources error:', error.message);
        res.status(500).json({ message: 'Failed to fetch resources', error: error.message });
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

        // External URL download or redirect stream
        if (resource.url && resource.url.startsWith('http')) {
            const typeStr = (resource.type || '').toLowerCase();
            const formatStr = (resource.format || '').toLowerCase();
            const urlStr = resource.url.toLowerCase();

            const isWebsiteOrMedia = typeStr.includes('website') || 
                                    typeStr.includes('youtube') ||
                                    formatStr.includes('website') ||
                                    formatStr.includes('youtube') ||
                                    urlStr.includes('youtube.com') ||
                                    urlStr.includes('youtu.be');

            if (isWebsiteOrMedia) {
                return res.redirect(resource.url);
            }

            try {
                const response = await axios({
                    url: resource.url,
                    method: 'GET',
                    responseType: 'stream'
                });

                const fileNameToUse = resource.fileName || path.basename(new URL(resource.url).pathname) || 'document.pdf';
                const safeFileName = String(fileNameToUse).replace(/[\\\"\r\n]/g, '_');
                // Send both the traditional filename and RFC 5987 UTF-8 filename
                // so browsers preserve the user's original uploaded filename.
                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`
                );
                const upstreamContentType = response.headers['content-type'];
                res.setHeader('Content-Type', upstreamContentType || 'application/octet-stream');
                if (response.headers['content-length']) {
                    res.setHeader('Content-Length', response.headers['content-length']);
                }
                return response.data.pipe(res);
            } catch (dlError) {
                // Fallback to direct redirect if proxy stream fails
                return res.redirect(resource.url);
            }
        }

        res.status(404).send('File unavailable');
    } catch (error) {
        console.error("Download Error:", error.message);
        res.status(500).send('Download failed');
    }
});

// ADD NEW RESOURCE
app.post('/resources', requireAuth, requireMongo, upload.single('file'), async (req, res) => {
    try {
        if (!req.body.name || !req.body.name.trim()) {
            return res.status(400).json({ message: 'Resource name is required.' });
        }

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
            clicks: 0,
            contributedBy: {
                userId: req.userSession.sub,
                email: req.userSession.email,
                name: req.userSession.name || ''
            }
        };

        invalidateResourceCache();

        const resource = new Resource(resourceData);
        const savedResource = await resource.save();
        return res.status(201).json(savedResource);
    } catch (error) {
        console.error("Save Resource Error:", error);
        res.status(500).json({
            message: 'Failed to add resource',
            error: error.message
        });
    }
});

// INCREMENT CLICK/VIEW COUNT
const handleClick = async (req, res) => {
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
};

app.patch('/resources/:id/click', handleClick);
app.post('/resources/:id/click', handleClick);

// DELETE RESOURCE
app.delete('/resources/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        invalidateResourceCache();

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
        const { name, email, password, roll, branch, educationLevel, schoolClass, stream, course, collegeName } = req.body;

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
                branch: branch || "Computer Science (CSE)",
                role: 'student',
                educationLevel: educationLevel || '',
                schoolClass: schoolClass || '',
                stream: stream || '',
                course: course || '',
                collegeName: collegeName || ''
            });
            await user.save();

            return res.status(201).json({
                message: 'Signup successful',
                token: createSession(user, 'student'),
                user: { name: user.name, email: user.email, roll: user.roll, branch: user.branch, role: 'student', educationLevel: user.educationLevel, schoolClass: user.schoolClass, stream: user.stream, course: user.course, collegeName: user.collegeName }
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
            branch: branch || "Computer Science (CSE)",
            role: 'student',
            educationLevel: educationLevel || '',
            schoolClass: schoolClass || '',
            stream: stream || '',
            course: course || '',
            collegeName: collegeName || ''
        };
        memoryUsers.push(newUser);

        res.status(201).json({
            message: 'Signup successful',
            token: createSession(newUser, 'student'),
            user: { name: newUser.name, email: newUser.email, roll: newUser.roll, branch: newUser.branch, role: 'student', educationLevel: newUser.educationLevel, schoolClass: newUser.schoolClass, stream: newUser.stream, course: newUser.course, collegeName: newUser.collegeName }
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
                token: createSession(user, 'student'),
                user: { name: user.name, email: user.email, roll: user.roll || "STU-OFFLINE", branch: user.branch || "Computer Science (CSE)", role: 'student', educationLevel: user.educationLevel || '', schoolClass: user.schoolClass || '', stream: user.stream || '', course: user.course || '', collegeName: user.collegeName || '' }
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
            token: createSession(user, 'student'),
            user: { name: user.name, email: user.email, roll: user.roll, branch: user.branch, role: 'student', educationLevel: user.educationLevel || '', schoolClass: user.schoolClass || '', stream: user.stream || '', course: user.course || '', collegeName: user.collegeName || '' }
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
        if (!isMongoConnected()) {
            return res.status(503).json({
                message: 'MongoDB is not connected. Configure MONGO_URI in the deployment environment.'
            });
        }
        const requests = await RequestModel.find().sort({ createdAt: -1 }).lean();
        return res.json(requests);
    } catch (error) {
        console.error('GET /requests error:', error.message);
        res.status(500).json({ message: 'Failed to fetch requests', error: error.message });
    }
});

// SUBMIT A NEW RESOURCE REQUEST
app.post('/requests', requireAuth, requireMongo, async (req, res) => {
    try {
        const { branch, resourceTitle, details } = req.body;
        const studentName = req.userSession.name || 'Student';
        const userEmail = req.userSession.email || '';
        if (!studentName || !branch || !resourceTitle) {
            return res.status(400).json({ message: 'Missing required request fields' });
        }

        const newRequest = new RequestModel({
            studentName,
            userEmail,
            requestedBy: {
                userId: req.userSession.sub,
                email: req.userSession.email,
                name: req.userSession.name || studentName
            },
            branch,
            resourceTitle,
            details
        });
        const savedRequest = await newRequest.save();
        return res.status(201).json(savedRequest);
    } catch (error) {
        res.status(500).json({ message: 'Failed to post request', error: error.message });
    }
});

// Get only the authenticated user's requests
app.get('/me/requests', requireAuth, requireMongo, async (req, res) => {
    try {
        const session = req.userSession;
        const filters = [{ userEmail: session.email }];
        if (session.sub && mongoose.Types.ObjectId.isValid(session.sub)) {
            filters.unshift({ 'requestedBy.userId': session.sub });
        }
        const requests = await RequestModel.find({ $or: filters }).sort({ createdAt: -1 }).lean();
        return res.json(requests);
    } catch (error) {
        console.error('GET /me/requests error:', error.message);
        return res.status(500).json({ message: 'Failed to fetch your requests.' });
    }
});

// Get only resources contributed by the authenticated user
app.get('/me/resources', requireAuth, requireMongo, async (req, res) => {
    try {
        const session = req.userSession;
        const filters = [{ 'contributedBy.email': session.email }];
        if (session.sub) filters.unshift({ 'contributedBy.userId': session.sub });
        const resources = await Resource.find({ $or: filters })
            .select('_id name category classLevel stream branch year semester type genre subject format url fileName clicks createdAt contributedBy')
            .sort({ createdAt: -1 })
            .lean();
        return res.json(resources);
    } catch (error) {
        console.error('GET /me/resources error:', error.message);
        return res.status(500).json({ message: 'Failed to fetch your contributed resources.' });
    }
});

// DELETE/RESOLVE REQUEST
app.delete('/requests/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const session = req.userSession;
        const isAdmin = session.role === 'admin';

        let requestDoc = null;
        if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
            requestDoc = await RequestModel.findById(id).lean();
        } else {
            requestDoc = memoryRequests.find(r => r._id === id || r.id === id) || null;
        }

        if (!requestDoc) {
            return res.status(404).json({ message: 'Request not found.' });
        }

        const ownerEmail = String(requestDoc.userEmail || '').toLowerCase().trim();
        const requesterEmail = String(session.email || '').toLowerCase().trim();
        const isOwner = ownerEmail && requesterEmail && ownerEmail === requesterEmail;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: 'You can only delete your own requests.' });
        }

        if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
            await RequestModel.findByIdAndDelete(id);
        } else {
            memoryRequests = memoryRequests.filter(r => r._id !== id && r.id !== id);
        }

        return res.json({ message: isAdmin ? 'Request deleted successfully by admin.' : 'Your request was cancelled successfully.' });
    } catch (error) {
        console.error('Delete Request Error:', error);
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
