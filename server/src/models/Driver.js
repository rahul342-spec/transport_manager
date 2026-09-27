const mongoose = require('mongoose');
const { tenantPlugin, baseOptions } = require('./plugins');

const driverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    employeeId: { type: String, trim: true },
    salary: { type: Number, min: 0 },
    active: { type: Boolean, default: true },
  },
  baseOptions
);
driverSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Driver', driverSchema);
