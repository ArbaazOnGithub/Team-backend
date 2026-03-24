require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('./models/Company');

const MONGODB_URI = process.env.MONGODB_URI;

async function createCompany() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB...");

        const name = process.argv[2];
        const slug = process.argv[3];

        if (!name || !slug) {
            console.log("\n❌ Usage: node create-company.js \"<Company Name>\" <company-slug>");
            console.log("Example: node create-company.js \"Acme Corp\" acme-corp\n");
            process.exit(1);
        }

        const existing = await Company.findOne({ slug });
        if (existing) {
            console.log(`\n❌ A company with the slug '${slug}' already exists.\n`);
            process.exit(1);
        }

        const newCompany = await Company.create({
            name,
            slug: slug.toLowerCase().trim()
        });

        console.log(`\n✅ Successfully created new company!`);
        console.log(`- Name: ${newCompany.name}`);
        console.log(`- Slug: ${newCompany.slug}`);
        console.log(`\n👉 Users can now register and login on the frontend using the Company ID: ${newCompany.slug}\n`);
        
        process.exit(0);
    } catch (err) {
        console.error("Failed:", err);
        process.exit(1);
    }
}

createCompany();
