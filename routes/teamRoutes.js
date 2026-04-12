const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { protect, superAdminOnly } = require('../middlewares/authMiddleware');

router.use(protect);
router.use(superAdminOnly);

router.post('/', teamController.createTeam);
router.get('/company/:companyId', teamController.getTeamsByCompany);
router.put('/:id', teamController.updateTeam);
router.delete('/:id', teamController.deleteTeam);

module.exports = router;
