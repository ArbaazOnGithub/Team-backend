const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');

// Pulic Route
router.get('/:slug', companyController.getCompanyBySlug);

module.exports = router;
