const mongoose = require('mongoose');
const { tenantPlugin, baseOptions } = require('./plugins');

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    gstNumber: { type: String, trim: true, uppercase: true },
    active: { type: Boolean, default: true },
  },
  baseOptions
);
clientSchema.plugin(tenantPlugin);
clientSchema.index({ businessId: 1, name: 1 });

module.exports = mongoose.model('Client', clientSchema);
