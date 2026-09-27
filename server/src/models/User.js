const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { tenantPlugin } = require('./plugins');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['owner'], default: 'owner' },
  },
  { timestamps: true }
);
userSchema.plugin(tenantPlugin);

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};
userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, 10);

module.exports = mongoose.model('User', userSchema);
