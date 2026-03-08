const Message = require('../models/Message');

exports.getMessages = async (req, res) => {
    try {
        const messages = await Message.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('user', 'name profileImage role')
            .populate('pinnedBy', 'name');

        // Return messages in chronological order for the UI
        res.json(messages.reverse());
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch messages' });
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
