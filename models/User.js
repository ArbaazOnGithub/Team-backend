const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    mobile: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    profileImage: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    paidLeaveBalance: { type: Number, default: 0 },

    // Fields for Password Reset
    resetOtp: { type: String },
    resetOtpExpire: { type: Date },

    createdAt: { type: Date, default: Date.now }
});

UserSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.resetOtp;
    delete obj.resetOtpExpire;
    return obj;
};

module.exports = mongoose.model('User', UserSchema);
