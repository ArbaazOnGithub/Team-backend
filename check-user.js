require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Company = require('./models/Company');

async function checkUser() {
    await mongoose.connect(process.env.MONGODB_URI);
    const email = "shaikhtauheed625@gmail.com";
    const slug = "turbo-net";
    
    const company = await Company.findOne({ slug });
    if (!company) {
        console.log("Company not found");
        process.exit();
    }
    
    const user = await User.findOne({ email, company: company._id });
    if (user) {
        console.log(`User found! Mobile: ${user.mobile}, Company: ${company.name}`);
    } else {
        console.log("User not found in this company.");
        // Check if user exists in OTHER companies
        const others = await User.find({ email }).populate('company');
        others.forEach(u => console.log(`- Found in company: ${u.company?.name} ([${u.company?.slug}])`));
    }
    process.exit();
}
checkUser();
