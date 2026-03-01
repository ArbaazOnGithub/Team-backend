const User = require('../models/User');
const Request = require('../models/Request');

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

// Get all request logs for admin
exports.getRequestLogs = async (req, res) => {
    try {
        const logs = await Request.find({})
            .sort({ createdAt: -1 })
            .populate('user', 'name email mobile')
            .populate('actionBy', 'name');
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch request logs' });
    }
};

// Update user role
exports.updateUserRole = async (req, res) => {
    try {
        const { userId, role } = req.body;
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await User.findByIdAndUpdate(userId, { role }, { new: true });
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({ message: 'User role updated successfully', user });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user role' });
    }
};

// Delete user
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findByIdAndDelete(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

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

        const user = await User.findById(userId);
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
        const users = await User.find({}, '_id');

        // Create notifications for all users
        const notificationPromises = users.map(user =>
            Notification.create({
                user: user._id,
                message: message.trim(),
                type: 'admin_announcement'
            })
        );

        await Promise.all(notificationPromises);

        // Broadcast to all connected clients
        io.emit('admin_announcement', {
            message: message.trim(),
            senderName: req.user.name,
            createdAt: new Date()
        });

        res.json({ message: 'Announcement broadcasted successfully to all users!' });
    } catch (error) {
        console.error("Announcement error:", error);
        res.status(500).json({ error: 'Failed to send announcement' });
    }
};
