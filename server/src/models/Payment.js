const mongoose = require('mongoose');
const { tenantPlugin, baseOptions } = require('./plugins');

const { ObjectId } = mongoose.Schema.Types;

const paymentSchema = new mongoose.Schema(
  {
    clientId: { type: ObjectId, ref: 'Client', required: true },
    workEntryId: { type: ObjectId, ref: 'WorkEntry' },
    invoiceId: { type: ObjectId, ref: 'Invoice' },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true },
    method: { type: String, enum: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'], default: 'Cash' },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  baseOptions
);
paymentSchema.plugin(tenantPlugin);
paymentSchema.index({ businessId: 1, date: -1 });
paymentSchema.index({ businessId: 1, workEntryId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
