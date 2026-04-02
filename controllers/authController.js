const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAction } = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

exports.register = async (req, res) => {
    const { mobile, name, password, email, companyId } = req.body;

    if (!mobile || !name || !password || !email || !companyId) return res.status(400).json({ error: 'All fields, including company, are required' });
    if (!/^[0-9]{10}$/.test(mobile)) return res.status(400).json({ error: 'Mobile must be 10 digits' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const profileImage = req.file ? req.file.path : "";

    try {
        const existingUser = await User.findOne({ company: companyId, $or: [{ mobile }, { email }] });
        if (existingUser) return res.status(400).json({ error: "Mobile or Email already registered in this company" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userCount = await User.countDocuments({ company: companyId });
        const role = userCount === 0 ? 'admin' : 'user';

        const newUser = new User({ mobile, email, name, password: hashedPassword, profileImage, role, company: companyId });
        await newUser.save();

        const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });
        await logAction(newUser._id, 'Registered a new account', 'auth', { mobile: newUser.mobile });
        res.status(201).json({ user: newUser.toJSON(), token });
    } catch (dbErr) {
        console.error(dbErr);
        res.status(500).json({ error: 'Registration failed' });
    }
};

exports.login = async (req, res) => {
    const { mobile, password, companyId } = req.body;
    if (!mobile || !password || !companyId) return res.status(400).json({ error: 'Mobile, password, and company required' });

    try {
        const user = await User.findOne({ mobile, company: companyId });
        if (!user) return res.status(404).json({ error: "User not found in this company" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        // ✅ Proactive SuperAdmin Enforcement
        const superMobile = '9399285780';
        if (user.mobile === superMobile && user.role !== 'superadmin') {
            user.role = 'superadmin';
            await user.save();
            console.log(`✓ Restored SuperAdmin role for ${superMobile} during login`);
        }

        await logAction(user._id, 'Logged in to the system', 'auth');
        res.json({ user: user.toJSON(), token });
    } catch (err) {
        res.status(500).json({ error: 'Login error' });
    }
};

exports.forgotPassword = async (req, res) => {
    const { email, companyId } = req.body;
    const transporter = req.app.get('transporter');

    if (!email || !companyId) return res.status(400).json({ error: "Email and company are required" });

    try {
        console.log(`[ForgotPass] Searching for user: ${email} in company: ${companyId}`);
        const user = await User.findOne({ email: email.toLowerCase(), company: companyId });
        console.log(`[ForgotPass] User found: ${user ? 'Yes' : 'No'}`);
        if (!user) return res.status(404).json({ error: "User does not exist please register first" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetOtp = otp;
        user.resetOtpExpire = Date.now() + 10 * 60 * 1000;
        await user.save();

        try {
            console.log(`[ForgotPass] Attempting to send OTP email to: ${user.email}`);
            await transporter.sendMail({
                from: 'Team App <' + process.env.EMAIL_USER + '>',
                to: user.email,
                subject: 'Password Reset OTP',
                text: `Your OTP for password reset is: ${otp}. This OTP is for the mobile number: ${user.mobile}`
            });
            console.log(`[ForgotPass] Email sent successfully to ${user.email}`);
            res.json({ message: "OTP sent to your email!", mobile: user.mobile });
        } catch (emailError) {
            console.error("Email Send FAILED:", emailError);
            res.status(500).json({ error: "Email failed to send", details: emailError.message });
        }
    } catch (err) {
        console.error("Forgot Password Process CRASH:", err);
        res.status(500).json({ error: "Failed to process request", details: err.message });
    }
};

exports.resetPassword = async (req, res) => {
    const { email, otp, newPassword, companyId } = req.body;

    if (!email || !otp || !newPassword || !companyId) return res.status(400).json({ error: "All fields required" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Password min 6 chars" });

    try {
        const user = await User.findOne({
            email: email.toLowerCase(),
            company: companyId,
            resetOtp: otp,
            resetOtpExpire: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ error: "Invalid or expired OTP" });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetOtp = undefined;
        user.resetOtpExpire = undefined;
        await user.save();

        await logAction(user._id, 'Reset password via OTP', 'auth');
        res.json({ message: "Password updated successfully! Please login." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Reset failed" });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { name } = req.body;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        if (name) user.name = name;
        if (req.file) user.profileImage = req.file.path;

        await user.save();
        res.json({ message: "Profile updated successfully", user: user.toJSON() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update profile" });
    }
};

exports.updateFcmToken = async (req, res) => {
    try {
        const { fcmToken } = req.body;
        if (!fcmToken) return res.status(400).json({ error: "Token required" });
        
        await User.findByIdAndUpdate(req.userId, { fcmToken });
        res.json({ message: "FCM Token updated" });
    } catch (err) {
        console.error('FCM Token update error:', err);
        res.status(500).json({ error: "FCM update failed" });
    }
};
