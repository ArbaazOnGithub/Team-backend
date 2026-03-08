const Message = require('../models/Message');
const User = require('../models/User');

exports.getMessages = async (req, res) => {
    try {
        const messages = await Message.find()
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
        const users = await User.find({}, 'name profileImage role');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

exports.togglePin = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        const isPinned = !message.isPinned;
        const updated = await Message.findByIdAndUpdate(
            req.params.id,
            {
                isPinned,
                pinnedBy: isPinned ? req.userId : null
            },
            { new: true }
        ).populate('user', 'name profileImage role').populate('pinnedBy', 'name');

        const io = req.app.get('socketio');
        io.emit('message_pinned', updated);

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to toggle pin' });
    }
};
