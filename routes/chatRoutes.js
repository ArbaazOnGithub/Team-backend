const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/auth');
const { storage } = require('../config/cloudinary');
const multer = require('multer');
const upload = multer({ storage }).single('chatFile');

router.use(authMiddleware);

router.get('/', chatController.getMessages);
router.post('/upload', upload, chatController.uploadMessageFile);
router.get('/users', chatController.getUsers);
router.patch('/pin/:id', chatController.togglePin);
router.delete('/:id', chatController.deleteMessage);

module.exports = router;
