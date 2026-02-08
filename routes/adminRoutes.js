const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

// Apply auth and admin middleware to all routes
router.use(auth, admin);

router.get('/users', adminController.getAllUsers);
router.get('/requests/logs', adminController.getRequestLogs);
router.put('/users/role', adminController.updateUserRole);
router.delete('/users/:userId', adminController.deleteUser);

module.exports = router;
