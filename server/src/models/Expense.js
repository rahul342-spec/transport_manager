const mongoose = require('mongoose');
const { tenantPlugin, baseOptions } = require('./plugins');

const CATEGORIES = ['Diesel', 'Salary', 'Maintenance', 'Toll/Parking', 'Other'];

const expenseSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 0 },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
    description: { type: String, trim: true },
    reference: { type: String, trim: true },
  },
  baseOptions
);
expenseSchema.plugin(tenantPlugin);
expenseSchema.index({ businessId: 1, date: -1 });

const Expense = mongoose.model('Expense', expenseSchema);
Expense.CATEGORIES = CATEGORIES;
module.exports = Expense;
