const mongoose = require('mongoose');
const { tenantPlugin, baseOptions } = require('./plugins');

const vehicleSchema = new mongoose.Schema(
  {
    vehicleNumber: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, trim: true },
    model: { type: String, trim: true },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  baseOptions
);
vehicleSchema.plugin(tenantPlugin);
vehicleSchema.index({ businessId: 1, vehicleNumber: 1 }, { unique: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);
