require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const User = require('./models/User');
const errorHandler = require('./middlewares/errorHandler');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const requestRoutes = require('./routes/requestRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const companyRoutes = require('./routes/companyRoutes');
const Message = require('./models/Message');
const { sendPushNotification } = require('./utils/notificationService');

const app = express();
const server = http.createServer(app);

// --- 1. CONFIGURATION ---
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/team_app_v3';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// --- 2. BREVO API EMAIL SENDER ---
const https = require('https');

const sendBrevoEmail = async ({ to, subject, htmlContent, textContent }) => {
  const data = JSON.stringify({
    sender: { email: (process.env.EMAIL_USER || "mohd.arbaaz.job@gmail.com").trim(), name: "Team App" },
    to: [{ email: to }],
    subject: subject,
    htmlContent: htmlContent || textContent, // Use text as fallback for HTML
    textContent: textContent
  });

  const options = {
    hostname: 'api.brevo.com',
    port: 443,
    path: '/v3/smtp/email',
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': (process.env.EMAIL_PASS || "").trim(),
      'content-type': 'application/json',
      'content-length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(responseBody));
        } else {
          reject(new Error(`Brevo API Error: ${res.statusCode} - ${responseBody}`));
        }
      });
    });

    req.on('error', (error) => reject(error));
    req.write(data);
    req.end();
  });
};

// SIMULATE Nodemailer interface
const transporterSim = {
  sendMail: async ({ to, subject, html, text }) => {
    return sendBrevoEmail({ to, subject, htmlContent: html, textContent: text });
  }
};
app.set('transporter', transporterSim);
console.log("✓ Brevo API Email Sender (HTTP) is Ready");

// --- 3. MIDDLEWARE ---

// ✅ Optimized CORS Configuration for Render/Vercel
const allowedOrigins = [
  "https://attendance.n1solution.in",
  "https://team-frontend-murex.vercel.app",
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost",
  "https://localhost",
  "capacitor://localhost"
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) {
        callback(null, true);
    } else {
        // Log the mismatch instead of throwing a hard error
        console.warn(`CORS Mismatch: ${origin} not in allowed origins`);
        callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-company-context', 'Accept']
}));

app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// --- 4. SOCKET.IO ---
const io = new Server(server, {
  cors: {
    origin: [
      "https://attendance.n1solution.in",
      "https://team-frontend-murex.vercel.app",
      process.env.FRONTEND_URL,
      "http://localhost:5173",
      "http://localhost",
      "https://localhost",
      "capacitor://localhost"
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true
  }
});
app.set('socketio', io);

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return next(new Error('Authentication error'));
    
    socket.userId = user._id;
    socket.userCompany = user.company; // Multi-tenancy context
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

app.use('/api', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);

app.get('/', (req, res) => res.send("Backend is Running"));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

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
  .then(async () => {
    console.log("✓ MongoDB Connected");

    // --- Super Admin Auto-Promotion ---
    try {
      const superMobile = '9399285780';
      // 1. Force the designated user to be superadmin
      const superUser = await User.findOneAndUpdate(
        { mobile: superMobile },
        { role: 'superadmin' },
        { new: true }
      );
      if (superUser) {
        console.log(`✓ Enforced Super Admin role for ${superMobile}`);
      }

      // 2. Force downgrade any impostor superadmins back to admin
      const impostors = await User.updateMany(
        { role: 'superadmin', mobile: { $ne: superMobile } },
        { role: 'admin' }
      );
      if (impostors.modifiedCount > 0) {
        console.warn(`! Downgraded ${impostors.modifiedCount} impostor superadmin(s)`);
      }
    } catch (err) {
      console.error("✗ Failed to enforce Super Admin role:", err.message);
    }

    server.listen(PORT, '0.0.0.0', () => console.log(`✓ Server running on port ${PORT}`));
  })
  .catch(err => console.error("✗ MongoDB Connection Error:", err));

// --- Socket Events ---
io.on('connection', (socket) => {
  console.log(`✓ Socket Connected: ${socket.userId}`);

  // Join private room and company room
  socket.join(socket.userId.toString());
  if (socket.userCompany) {
      socket.join(socket.userCompany.toString());
  }

  // Chat logic
  socket.on('send_message', async (data) => {
    try {
      const content = typeof data === 'string' ? data : data.content;
      const fileUrl = data.fileUrl || null;
      const fileType = data.fileType || null;

      let newMessage = new Message({
        user: socket.userId,
        company: socket.userCompany,
        content: content?.trim(),
        fileUrl,
        fileType
      });
      await newMessage.save();
      newMessage = await (await newMessage.populate('user', 'name profileImage role')).populate('readBy', 'name profileImage');
      io.to(socket.userCompany.toString()).emit('receive_message', newMessage);

      // Send Push Notification to all users in the same company except the sender
      const usersInCompany = await User.find({ company: socket.userCompany, _id: { $ne: socket.userId }, fcmToken: { $exists: true, $ne: '' } });
      const tokens = usersInCompany.map(u => u.fcmToken);
      
      if (tokens.length > 0) {
        const { notifyMultiple } = require('./utils/notificationService');
        notifyMultiple(tokens, `New message from ${newMessage.user.name}`, newMessage.content || 'Sent an attachment', { type: 'chat' });
      }
    } catch (err) {
      console.error("Chat error:", err);
    }
  });

  socket.on('mark_read', async (messageId) => {
    try {
      const msg = await Message.findById(messageId);
      if (msg && !msg.readBy.includes(socket.userId)) {
        msg.readBy.push(socket.userId);
        await msg.save();
        const updatedMsg = await msg.populate('readBy', 'name profileImage');
        io.to(socket.userCompany.toString()).emit('message_read_update', { messageId: msg._id, readBy: updatedMsg.readBy });
      }
    } catch (err) {
      console.error("Read mark error:", err);
    }
  });

  socket.on('disconnect', () => console.log('✗ Socket Disconnected'));
});
