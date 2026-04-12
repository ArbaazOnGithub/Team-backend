const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const auth = require('../middlewares/auth');
const superadmin = require('../middlewares/superadmin');

router.use(auth);

// Only Super Admin can manage teams
router.post('/', superadmin, teamController.createTeam);
router.get('/company/:companyId', superadmin, teamController.getTeamsByCompany);
router.put('/:id', superadmin, teamController.updateTeam);
router.delete('/:id', superadmin, teamController.deleteTeam);

module.exports = router;
