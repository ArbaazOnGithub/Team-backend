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
        const message = await Message.findOne({ _id: req.params.id, company: req.userCompany });
        if (!message) return res.status(404).json({ error: 'Message not found' });

        const isPinned = !message.isPinned;
        const updated = await Message.findOneAndUpdate(
            { _id: req.params.id, company: req.userCompany },
            {
                isPinned,
                pinnedBy: isPinned ? req.userId : null
            },
            { new: true }
        ).populate('user', 'name profileImage role').populate('pinnedBy', 'name');

        const io = req.app.get('socketio');
        io.emit('message_pinned', updated);

        await logAction(req.userId, `${isPinned ? 'Pinned' : 'Unpinned'} a message`, 'chat', { messageId: req.params.id });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to toggle pin' });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const message = await Message.findOne({ _id: req.params.id, company: req.userCompany });
        if (!message) return res.status(404).json({ error: 'Message not found' });

        // Authorization: Admin or the person who sent the message
        if (req.user.role !== 'admin' && message.user.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await Message.findOneAndDelete({ _id: req.params.id, company: req.userCompany });

        const io = req.app.get('socketio');
        io.emit('message_deleted', req.params.id);

        await logAction(req.userId, 'Deleted a chat message', 'chat', { content: message.content.substring(0, 50) });

        res.json({ message: 'Message deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete message' });
    }
};
