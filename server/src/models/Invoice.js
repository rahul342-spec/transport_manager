const mongoose = require('mongoose');
const { tenantPlugin, baseOptions } = require('./plugins');

const { ObjectId } = mongoose.Schema.Types;

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true },
    date: { type: Date, required: true },
    dueDate: { type: Date },
    clientId: { type: ObjectId, ref: 'Client', required: true },
    workEntryIds: [{ type: ObjectId, ref: 'WorkEntry' }],
    subtotal: { type: Number, required: true, min: 0 },
    gstPercent: { type: Number, default: 0, min: 0 },
    gstAmount: { type: Number, default: 0 },
    total: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
  },
  baseOptions
);
invoiceSchema.plugin(tenantPlugin);
invoiceSchema.index({ businessId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
