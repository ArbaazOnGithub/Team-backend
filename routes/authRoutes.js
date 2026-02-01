const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Multer is still needed for register, I'll pass it from index.js or re-configure here
// For modularity, let's re-configure a basic one or pass it.
// Given the original structure, I'll define a simple upload middleware here or in a separate file.

const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage }).single('profileImage');

const auth = require('../middlewares/auth');

router.post('/register', upload, authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.put('/profile', auth, upload, authController.updateProfile);

module.exports = router;
