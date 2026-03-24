const User = require('../models/User');
const Request = require('../models/Request');
const AuditLog = require('../models/AuditLog');
const { logAction } = require('../utils/logger');

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        // If the requester is an admin (but not a superadmin), hide the superadmin from the list
        const query = { company: req.userCompany };
        if (req.user.role === 'admin') query.role = { $ne: 'superadmin' };
        const users = await User.find(query).sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

// Get all request logs for admin
exports.getRequestLogs = async (req, res) => {
    try {
        const logs = await Request.find({ company: req.userCompany })
            .sort({ createdAt: -1 })
            .populate('user', 'name email mobile')
            .populate('actionBy', 'name');
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch request logs' });
    }
};

// Get all system error logs (Super Admin Only)
exports.getSystemErrorLogs = async (req, res) => {
    try {
        const SystemErrorLog = require('../models/SystemErrorLog');
        const logs = await SystemErrorLog.find({ company: req.userCompany })
            .sort({ createdAt: -1 })
            .populate('user', 'name email role');
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch system error logs' });
    }
};

// Get all request logs for admin
exports.getSystemLogs = async (req, res) => {
    try {
        const logs = await AuditLog.find({ company: req.userCompany })
            .sort({ createdAt: -1 })
            .populate('user', 'name email role');
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch system logs' });
    }
};

// Update user role
exports.updateUserRole = async (req, res) => {
    try {
        // Only superadmins can change roles
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Access denied. Only Super Admins can modify roles.' });
        }

        const { userId, role } = req.body;
        // Cannot assign superadmin role to anyone else via this endpoint
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role assignment' });
        }

        const user = await User.findOneAndUpdate(
            { _id: userId, company: req.userCompany },
            { role },
            { new: true }
        );
        if (!user) return res.status(404).json({ error: 'User not found' });

        await logAction(req.userId, `Changed role of ${user.name} to ${role}`, 'admin', { targetUserId: userId, newRole: role });

        res.json({ message: 'User role updated successfully', user });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user role' });
    }
};

// Delete user
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findOneAndDelete({ _id: userId, company: req.userCompany });
        if (!user) return res.status(404).json({ error: 'User not found' });

        await logAction(req.userId, `Deleted user: ${user.name}`, 'admin', { deletedUserId: userId });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
};
// Update user leave balance
exports.updateUserLeaveBalance = async (req, res) => {
    try {
        const { userId, newBalance, reason } = req.body;
        const Notification = require('../models/Notification');
        const io = req.app.get('socketio');

        const user = await User.findOne({ _id: userId, company: req.userCompany });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const oldBalance = user.paidLeaveBalance || 0;
        user.paidLeaveBalance = newBalance;
        await user.save();

        // Create notification
        const diff = newBalance - oldBalance;
        const message = `Admin adjusted your leave balance by ${diff > 0 ? '+' : ''}${diff} days. Reason: ${reason}`;

        const notification = await Notification.create({
            user: userId,
            message,
            type: 'leave_update'
        });

        // Emit real-time notification
        io.to(userId.toString()).emit('notification_received', notification);

        await logAction(req.userId, `Adjusted leave balance for ${user.name} by ${diff} days`, 'admin', { targetUserId: userId, diff, reason });

        res.json({ message: 'Leave balance updated successfully', user });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update leave balance' });
    }
};

// Send Announcement to all users
exports.sendAnnouncement = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Announcement message is required' });
        }

        const Notification = require('../models/Notification');
        const io = req.app.get('socketio');

        // Fetch all users to create individual notifications
        const users = await User.find({ company: req.userCompany }, '_id');

        // Create notifications for all users
        const notificationPromises = users.map(user =>
            Notification.create({
                user: user._id,
                message: message.trim(),
                type: 'admin_announcement'
            })
        );

        await Promise.all(notificationPromises);

        // Broadcast to all connected clients in the company
        io.to(req.userCompany.toString()).emit('admin_announcement', {
            message: message.trim(),
            senderName: req.user.name,
            createdAt: new Date()
        });

        await logAction(req.userId, 'Sent a global announcement', 'admin', { content: message.trim() });

        res.json({ message: 'Announcement broadcasted successfully to all users!' });
    } catch (error) {
        console.error("Announcement error:", error);
        res.status(500).json({ error: 'Failed to send announcement' });
    }
};
