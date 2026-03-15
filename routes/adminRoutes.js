const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');
const superadmin = require('../middlewares/superadmin');

// Apply auth and admin middleware to all routes
router.use(auth, admin);

router.get('/users', adminController.getAllUsers);
router.get('/superadmin/error-logs', superadmin, adminController.getSystemErrorLogs);
router.get('/system-logs', adminController.getSystemLogs);
router.get('/requests/logs', adminController.getRequestLogs);
router.put('/users/role', adminController.updateUserRole);
router.put('/users/leave-balance', adminController.updateUserLeaveBalance);
router.post('/announce', adminController.sendAnnouncement);
router.delete('/users/:userId', adminController.deleteUser);

module.exports = router;
