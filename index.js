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

// Route Imports
const authRoutes = require('./routes/authRoutes');
const requestRoutes = require('./routes/requestRoutes');

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
app.use(cors({
  origin: [
    "https://team-frontend-murex.vercel.app",
    process.env.FRONTEND_URL,
    "http://localhost:5173"
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 4. SOCKET.IO ---
const io = new Server(server, {
  cors: { origin: process.env.NODE_ENV === 'production' ? 'your-frontend-domain.com' : '*', methods: ["GET", "POST"] }
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

io.on('connection', (socket) => {
  console.log(`✓ Socket Connected: ${socket.userId}`);
  socket.on('disconnect', () => console.log('✗ Socket Disconnected'));
});

// --- 5. ROUTES ---
app.use('/api', authRoutes);
app.use('/api/requests', requestRoutes);

app.get('/', (req, res) => res.send("Backend is Running"));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- 6. DATABASE & SERVER ---
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log("✓ MongoDB Connected");
    server.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));
  })
  .catch(err => console.error("✗ MongoDB Connection Error:", err));
