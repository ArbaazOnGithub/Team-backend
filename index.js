require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const User = require('./models/User');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const requestRoutes = require('./routes/requestRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const server = http.createServer(app);

// --- 1. CONFIGURATION ---
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/team_app_v3';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// --- 2. TRANSPORTER ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
app.set('transporter', transporter);

// --- 3. MIDDLEWARE ---

// ✅ FIX #1: Enhanced CORS Configuration
app.use(cors({
  origin: [
    "https://attendance.n1solution.in",
    "https://team-frontend-murex.vercel.app",
    process.env.FRONTEND_URL,
    "http://localhost:5173"
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ✅ FIX #2: Add Global Headers for CORB Fix - MUST BE BEFORE ROUTES
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  next();
});

app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// ✅ FIX #3: Serve Static Files with Proper Headers (CRITICAL FIX)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // Set correct Content-Type based on file extension
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.png') {
      res.set('Content-Type', 'image/png');
    } else if (ext === '.jpg' || ext === '.jpeg') {
      res.set('Content-Type', 'image/jpeg');
    } else if (ext === '.gif') {
      res.set('Content-Type', 'image/gif');
    } else if (ext === '.webp') {
      res.set('Content-Type', 'image/webp');
    }

    // CORS headers for images - FIXES CORB ERROR
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'public, max-age=31536000');
  }
}));

// --- 4. SOCKET.IO ---
const io = new Server(server, {
  cors: {
    origin: [
      "https://attendance.n1solution.in",
      "https://team-frontend-murex.vercel.app",
      process.env.FRONTEND_URL,
      "http://localhost:5173"
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true
  }
});
app.set('socketio', io);

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

app.use('/api', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => res.send("Backend is Running"));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- 7. CRON JOBS ---
// Increment paidLeaveBalance by 2.5 on the 1st of every month at midnight
cron.schedule('0 0 1 * *', async () => {
  try {
    console.log("Running monthly leave accumulation job...");
    await User.updateMany({}, { $inc: { paidLeaveBalance: 2.5 } });
    console.log("✓ Leave accumulation completed");
  } catch (error) {
    console.error("✗ Leave accumulation failed:", error);
  }
});

// --- 6. DATABASE & SERVER ---
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log("✓ MongoDB Connected");
    server.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));
  })
  .catch(err => console.error("✗ MongoDB Connection Error:", err));

// --- Socket Events ---
io.on('connection', (socket) => {
  console.log(`✓ Socket Connected: ${socket.userId}`);

  // Join private room
  socket.join(socket.userId.toString());

  socket.on('disconnect', () => console.log('✗ Socket Disconnected'));
});
