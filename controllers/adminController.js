const User = require('../models/User');
const Request = require('../models/Request');
const AuditLog = require('../models/AuditLog');
const { logAction } = require('../utils/logger');

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const query = { company: req.userCompany };
        if (req.user.role === 'admin') {
            query.role = { $ne: 'superadmin' };
            // Include their primary team AND any additional managed teams
            const allowedTeams = [req.user.team, ...(req.user.managedTeams || [])].filter(Boolean);
            query.team = { $in: allowedTeams };
        }
        const users = await User.find(query).sort({ createdAt: -1 }).populate('team', 'name').populate('managedTeams', 'name');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

// Get all request logs for admin
exports.getRequestLogs = async (req, res) => {
    try {
        const query = { company: req.userCompany };
        if (req.user.role === 'admin') {
            const allowedTeams = [req.user.team, ...(req.user.managedTeams || [])].filter(Boolean);
            query.team = { $in: allowedTeams };
        }

        const logs = await Request.find(query)
            .sort({ createdAt: -1 })
            .populate('user', 'name email mobile')
            .populate('actionBy', 'name')
            .populate('team', 'name');
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
        const query = { company: req.userCompany };
        if (req.user.role === 'admin') {
            const allowedTeams = [req.user.team, ...(req.user.managedTeams || [])].filter(Boolean);
            query.team = { $in: allowedTeams };
        }

        const logs = await AuditLog.find(query)
            .sort({ createdAt: -1 })
            .populate('user', 'name email role')
            .populate('team', 'name');
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

        const { userId, role, teamId, managedTeams } = req.body;
        // Cannot assign superadmin role to anyone else via this endpoint
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role assignment' });
        }

        const updateData = { role };
        if (teamId) updateData.team = teamId;
        if (managedTeams) updateData.managedTeams = managedTeams;

        const user = await User.findOneAndUpdate(
            { _id: userId, company: req.userCompany },
            updateData,
            { new: true }
        ).populate('team', 'name').populate('managedTeams', 'name');
        if (!user) return res.status(404).json({ error: 'User not found' });

        await logAction(req.userId, `Changed role of ${user.name} to ${role}`, 'admin', { targetUserId: userId, newRole: role }, req.userCompany);

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

        await logAction(req.userId, `Deleted user: ${user.name}`, 'admin', { deletedUserId: userId }, req.userCompany);

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
            company: req.userCompany,
            message,
            type: 'leave_update'
        });

        // Emit real-time notification
        io.to(userId.toString()).emit('notification_received', notification);

        await logAction(req.userId, `Adjusted leave balance for ${user.name} by ${diff} days`, 'admin', { targetUserId: userId, diff, reason }, req.userCompany);

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
                company: req.userCompany,
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

        await logAction(req.userId, 'Sent a global announcement', 'admin', { content: message.trim() }, req.userCompany);


        res.json({ message: 'Announcement broadcasted successfully to all users!' });
    } catch (error) {
        console.error("Announcement error:", error);
        res.status(500).json({ error: 'Failed to send announcement' });
    }
};

// --- SUPER ADMIN: COMPANY MANAGEMENT ---

exports.getAllCompanies = async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Access denied. Super Admins only.' });
        }
        
        const Company = require('../models/Company');
        const companies = await Company.find().sort({ createdAt: -1 });
        
        // Aggregate user counts per company
        const userCounts = await User.aggregate([
            { $group: { _id: "$company", count: { $sum: 1 } } }
        ]);
        
        const companiesWithStats = companies.map(comp => {
            const stat = userCounts.find(uc => uc._id.toString() === comp._id.toString());
            return {
                ...comp.toJSON(),
                userCount: stat ? stat.count : 0
            };
        });

        res.json(companiesWithStats);
    } catch (error) {
        console.error("Error fetching companies:", error);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
};

exports.createCompany = async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Access denied. Super Admins only.' });
        }

        const { name, slug } = req.body;
        if (!name || !slug) return res.status(400).json({ error: 'Name and slug are required' });

        const Company = require('../models/Company');
        const normalizedSlug = slug.toLowerCase().trim();

        const existing = await Company.findOne({ slug: normalizedSlug });
        if (existing) return res.status(400).json({ error: 'A company with this slug already exists' });

        const company = await Company.create({ name, slug: normalizedSlug });
        await logAction(req.userId, `Created new company: ${name} (${normalizedSlug})`, 'admin', { newCompanyId: company._id }, req.userCompany);

        res.status(201).json(company);
    } catch (error) {
        console.error("Error creating company:", error);
        res.status(500).json({ error: 'Failed to create company' });
    }
};

exports.deleteCompany = async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Access denied. Super Admins only.' });
        }

        const companyId = req.params.id;
        const Company = require('../models/Company');

        const company = await Company.findById(companyId);
        if (!company) return res.status(404).json({ error: 'Company not found' });

        if (company.slug === 'n1solution') {
            return res.status(400).json({ error: 'The root N1Solution company cannot be deleted.' });
        }

        // --- CASCADING DELETE ---
        const Message = require('../models/Message');
        const Notification = require('../models/Notification');
        const Request = require('../models/Request');
        const SystemErrorLog = require('../models/SystemErrorLog');

        await Message.deleteMany({ company: companyId });
        await Notification.deleteMany({ company: companyId });
        await Request.deleteMany({ company: companyId });
        await AuditLog.deleteMany({ company: companyId });
        await SystemErrorLog.deleteMany({ company: companyId });
        await User.deleteMany({ company: companyId });

        await Company.findByIdAndDelete(companyId);

        await logAction(req.userId, `Deleted company: ${company.name} and ALL its data`, 'admin', { deletedCompanySlug: company.slug }, req.userCompany);

        res.json({ message: 'Company and all associated data successfully deleted.' });
    } catch (error) {
        console.error("Error deleting company:", error);
        res.status(500).json({ error: 'Failed to delete company' });
    }
};
