const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const authMiddleware = require('../middlewares/auth');
const adminMiddleware = require('../middlewares/admin');

router.use(authMiddleware);

router.post('/', requestController.createRequest);
router.get('/', requestController.getRequests);
router.get('/stats', requestController.getStats);
router.get('/detailed', adminMiddleware, requestController.getDetailedStats);
router.put('/:id', adminMiddleware, requestController.updateRequestStatus);
router.delete('/:id', requestController.deleteRequest);

module.exports = router;
