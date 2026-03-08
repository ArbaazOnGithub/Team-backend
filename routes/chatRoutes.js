const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/auth');

router.use(authMiddleware);

router.get('/', chatController.getMessages);
router.patch('/pin/:id', chatController.togglePin);

module.exports = router;
