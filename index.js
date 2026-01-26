const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer'); // <--- NEW IMPORT

const app = express();

// --- 1. CONFIGURATION ---
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/team_app_v3';

// --- NODEMAILER CONFIG (For Forgot Password) ---
// For testing, we will just LOG the OTP to the console if no email credentials are provided
// --- NODEMAILER CONFIG ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    // REPLACE THESE WITH YOUR ACTUAL DETAILS
    user: 'electronic.hub005@gmail.com', 
    pass: 'fotzhuspqnyuojxl' // The 16-char App Password from Step 1
  }
});
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER, // e.g., 'yourname@gmail.com'
//     pass: process.env.EMAIL_PASS  // e.g., your app password
//   }
// });

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'your-frontend-domain.com' : '*',
  credentials: true
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100 
});
app.use('/api/', limiter);

// --- 2. UPLOAD CONFIG ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5000000 },
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only image files are allowed!'));
  }
}).single('profileImage');

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 3. DATABASE ---
mongoose.connect(MONGODB_URI)
  .then(() => console.log("✓ MongoDB Connected"))
  .catch(err => console.error("✗ MongoDB Connection Error:", err));

// --- 4. MODELS ---
const UserSchema = new mongoose.Schema({
  mobile: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true }, // <--- NEW FIELD
  password: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  profileImage: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  
  // Fields for Password Reset
  resetOtp: { type: String },
  resetOtpExpire: { type: Date },
  
  createdAt: { type: Date, default: Date.now }
});

UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetOtp;
  delete obj.resetOtpExpire;
  return obj;
};

const User = mongoose.model('User', UserSchema);

const RequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  query: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['Pending', 'Approved', 'Resolved', 'Cancelled'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Request = mongoose.model('Request', RequestSchema);

// --- 5. MIDDLEWARE ---
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// --- 6. SERVER & SOCKET ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.NODE_ENV === 'production' ? 'your-frontend-domain.com' : '*', methods: ["GET", "POST"] }
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  /* socket logic */
});

// --- 7. ROUTES ---

// REGISTER (Now includes Email)
app.post('/api/register', (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'File upload error' });
    
    const { mobile, name, password, email } = req.body; // <--- ADDED email

    if (!mobile || !name || !password || !email) return res.status(400).json({ error: 'All fields are required' });
    if (!/^[0-9]{10}$/.test(mobile)) return res.status(400).json({ error: 'Mobile must be 10 digits' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const profileImage = req.file ? req.file.path.replace(/\\/g, "/") : "";

    try {
      const existingUser = await User.findOne({ $or: [{ mobile }, { email }] });
      if (existingUser) return res.status(400).json({ error: "Mobile or Email already registered" });

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const userCount = await User.countDocuments();
      const role = userCount === 0 ? 'admin' : 'user';

      const newUser = new User({ mobile, email, name, password: hashedPassword, profileImage, role });
      await newUser.save();

      const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ user: newUser.toJSON(), token });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ error: 'Registration failed' });
    }
  });
});

// LOGIN
app.post('/api/login', async (req, res) => {
  const { mobile, password } = req.body;
  if (!mobile || !password) return res.status(400).json({ error: 'Mobile and password required' });

  try {
    const user = await User.findOne({ mobile });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: user.toJSON(), token });
  } catch (err) {
    res.status(500).json({ error: 'Login error' });
  }
});

// --- FORGOT PASSWORD ROUTES ---

// 1. Request OTP
// 1. Request OTP
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  console.log(`[DEBUG] Forgot Password requested for: ${email}`); // 1. Log request

  try {
    const user = await User.findOne({ email });
    if (!user) {
        console.log("[DEBUG] User not found in DB");
        return res.status(404).json({ error: "User with this email not found" });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Save to DB (expires in 10 mins)
    user.resetOtp = otp;
    user.resetOtpExpire = Date.now() + 10 * 60 * 1000;
    await user.save();
    
    console.log(`[DEBUG] OTP Generated: ${otp}. Attempting to send email...`);

    // --- SEND EMAIL (Updated: No IF check, extensive logging) ---
    try {
        const info = await transporter.sendMail({
            from: 'Team App <your.actual.email@gmail.com>', // Put your email here visually
            to: user.email,
            subject: 'Password Reset OTP',
            text: `Your OTP for password reset is: ${otp}`
        });
        console.log("[DEBUG] Email sent successfully:", info.response);
        res.json({ message: "OTP sent to your email!" });
    } catch (emailError) {
        console.error("[DEBUG] Email Send FAILED:", emailError);
        // Fallback: If email fails, send OTP in response so you aren't stuck testing
        res.status(500).json({ error: "Email failed to send. Check server console for error details." }); 
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process request" });
  }
});

// 2. Verify OTP & Reset Password
app.post('/api/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) return res.status(400).json({ error: "All fields required" });
  if (newPassword.length < 6) return res.status(400).json({ error: "Password min 6 chars" });

  try {
    const user = await User.findOne({ 
        email, 
        resetOtp: otp, 
        resetOtpExpire: { $gt: Date.now() } // Check if not expired
    });

    if (!user) return res.status(400).json({ error: "Invalid or expired OTP" });

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Clear fields
    user.resetOtp = undefined;
    user.resetOtpExpire = undefined;
    await user.save();

    res.json({ message: "Password updated successfully! Please login." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Reset failed" });
  }
});

// REQUESTS
app.post('/api/requests', authMiddleware, async (req, res) => {
  const { query } = req.body;
  if (!query || !query.trim()) return res.status(400).json({ error: 'Query empty' });
  try {
    let newReq = new Request({ user: req.userId, query: query.trim() });
    await newReq.save();
    newReq = await newReq.populate('user', 'name profileImage role');
    io.emit('new_request', newReq);
    res.status(201).json(newReq);
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/requests', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    let query = status ? { status } : {};
    if (req.user.role !== 'admin') query.user = req.userId;
    const skip = (page - 1) * limit;
    const requests = await Request.find(query).sort({ createdAt: -1 }).limit(parseInt(limit)).skip(skip).populate('user', 'name profileImage role');
    const total = await Request.countDocuments(query);
    res.json({ requests, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/requests/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { status } = req.body;
  try {
    let updated = await Request.findByIdAndUpdate(req.params.id, { status, updatedAt: new Date() }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    updated = await updated.populate('user', 'name profileImage role');
    io.emit('status_update', updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/requests/:id', authMiddleware, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && request.user.toString() !== req.userId.toString()) return res.status(403).json({ error: 'Unauthorized' });
    await Request.findByIdAndDelete(req.params.id);
    io.emit('request_deleted', { id: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') query.user = req.userId;
    const stats = await Request.aggregate([{ $match: query }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
    const formattedStats = { Pending: 0, Approved: 0, Resolved: 0, Cancelled: 0 };
    stats.forEach(stat => { formattedStats[stat._id] = stat.count; });
    res.json(formattedStats);
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

server.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));