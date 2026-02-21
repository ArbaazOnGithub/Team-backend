const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middlewares/auth');

router.use(auth);

// Get user's notifications
router.get('/', async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.userId })
            .sort({ createdAt: -1 })
            .limit(20);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark all as read
router.put('/mark-read', async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.userId, isRead: false },
            { isRead: true }
        );
        res.json({ message: 'Notifications marked as read' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update notifications' });
    }
});

module.exports = router;
