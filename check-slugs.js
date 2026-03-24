require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('./models/Company');

async function checkSlugs() {
    await mongoose.connect(process.env.MONGODB_URI);
    const companies = await Company.find({});
    console.log("Registered Companies:");
    companies.forEach(c => console.log(`- ${c.name}: [${c.slug}]`));
    process.exit();
}
checkSlugs();
