const Company = require('../models/Company');

exports.getCompanyBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const company = await Company.findOne({ slug });
        
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        res.json({
            _id: company._id,
            name: company.name,
            slug: company.slug,
            logo: company.logo,
            settings: company.settings
        });
    } catch (err) {
        console.error("Error fetching company:", err);
        res.status(500).json({ error: "Failed to fetch company details" });
    }
};
