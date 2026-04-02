const Message = require('../models/Message');
const User = require('../models/User');
const { logAction } = require('../utils/logger');

exports.getMessages = async (req, res) => {
    try {
        const messages = await Message.find({ company: req.userCompany })
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('user', 'name profileImage role')
            .populate('pinnedBy', 'name')
            .populate('readBy', 'name profileImage');

        // Return messages in chronological order for the UI
        res.json(messages.reverse());
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const users = await User.find({ company: req.userCompany }, 'name profileImage role');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

exports.togglePin = async (req, res) => {
    try {
        const isAuthorized = req.user.role === 'admin' || req.user.role === 'superadmin';
        // Use a consistent company filter for both lookup and update
        const companyFilter = isAuthorized ? { $exists: true } : req.userCompany;

        const message = await Message.findOne({ 
            _id: req.params.id, 
            company: companyFilter
        });
        if (!message) return res.status(404).json({ error: 'Message not found' });

        const isPinned = !message.isPinned;
        const updated = await Message.findOneAndUpdate(
            { _id: req.params.id, company: companyFilter },
            {
                isPinned,
                pinnedBy: isPinned ? req.userId : null
            },
            { new: true }
        ).populate('user', 'name profileImage role').populate('pinnedBy', 'name');

        if (!updated) return res.status(404).json({ error: 'Message not found after update' });

        const io = req.app.get('socketio');
        io.emit('message_pinned', updated);

        await logAction(req.userId, `${isPinned ? 'Pinned' : 'Unpinned'} a message`, 'chat', { messageId: req.params.id });

        res.json(updated);
    } catch (err) {
        console.error('togglePin error:', err);
        res.status(500).json({ error: 'Failed to toggle pin' });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const isAuthorized = ['admin', 'superadmin'].includes(req.user.role);
        // Admins/superadmins can delete any company's message
        const companyFilter = isAuthorized ? { $exists: true } : req.userCompany;

        const message = await Message.findOne({ _id: req.params.id, company: companyFilter });
        if (!message) return res.status(404).json({ error: 'Message not found' });

        // Authorization: Admin/superadmin or the person who sent the message
        if (!isAuthorized && message.user.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await Message.findOneAndDelete({ _id: req.params.id, company: companyFilter });

        const io = req.app.get('socketio');
        io.emit('message_deleted', req.params.id);

        await logAction(req.userId, 'Deleted a chat message', 'chat', { content: message.content.substring(0, 50) });

        res.json({ message: 'Message deleted' });
    } catch (err) {
        console.error('deleteMessage error:', err);
        res.status(500).json({ error: 'Failed to delete message' });
    }
};

exports.uploadMessageFile = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        let type = 'document';
        if (req.file.mimetype.startsWith('image/')) type = 'image';
        else if (req.file.mimetype.startsWith('video/')) type = 'video';

        res.json({
            fileUrl: req.file.path,
            fileType: type
        });
    } catch (err) {
        console.error('uploadMessageFile error:', err);
        res.status(500).json({ error: 'Failed to upload file' });
    }
};
