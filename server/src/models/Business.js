const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    gstNumber: { type: String, trim: true, uppercase: true },
    defaultGstPercent: { type: Number, default: 0, min: 0, max: 28 },
    invoicePrefix: { type: String, trim: true, default: 'INV' },
    invoiceSeq: { type: Number, default: 0 }, // incremented atomically per invoice
    paymentTermsDays: { type: Number, default: 15, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Business', businessSchema);
