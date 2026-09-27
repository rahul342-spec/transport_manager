const mongoose = require('mongoose');
const { tenantPlugin, baseOptions } = require('./plugins');
const { totalHours, pending, paymentStatus } = require('../utils/calc');

const { ObjectId } = mongoose.Schema.Types;

const workEntrySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    clientId: { type: ObjectId, ref: 'Client', required: true },
    location: { type: String, required: true, trim: true },
    pickup: { type: String, trim: true },
    destination: { type: String, trim: true },
    vehicleId: { type: ObjectId, ref: 'Vehicle', required: true },
    driverId: { type: ObjectId, ref: 'Driver', required: true },
    startTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    endTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    hours: { type: Number, default: 0 },
    amount: { type: Number, required: true, min: 0 },
    // Sum of linked Payment records — kept in sync by services/payments.js
    received: { type: Number, default: 0, min: 0 },
    pendingAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['Paid', 'Partial', 'Pending'], default: 'Pending' },
    dueDate: { type: Date },
    reminderStatus: {
      type: String,
      enum: ['None', 'Reminded', 'Promised', 'Disputed'],
      default: 'None',
    },
    invoiceId: { type: ObjectId, ref: 'Invoice' },
    notes: { type: String, trim: true },
  },
  baseOptions
);
workEntrySchema.plugin(tenantPlugin);
workEntrySchema.index({ businessId: 1, date: -1 });
workEntrySchema.index({ businessId: 1, clientId: 1 });
workEntrySchema.index({ businessId: 1, status: 1 });

// Derived fields always recalculated on save
workEntrySchema.pre('save', function (next) {
  this.hours = totalHours(this.startTime, this.endTime);
  this.pendingAmount = pending(this.amount, this.received);
  this.status = paymentStatus(this.amount, this.received);
  next();
});

module.exports = mongoose.model('WorkEntry', workEntrySchema);
