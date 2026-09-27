// Clients, Vehicles, Drivers, Expenses — plain tenant-scoped CRUD
const express = require('express');
const mongoose = require('mongoose');
const { makeCrud } = require('../utils/crud');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const Client = require('../models/Client');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const Expense = require('../models/Expense');
const WorkEntry = require('../models/WorkEntry');
const Payment = require('../models/Payment');

// Records used in work entries can't be deleted — deactivate them instead (spec section 7)
const blockIfUsed = (field, label) => async (doc) => {
  const used = await WorkEntry.exists({ businessId: doc.businessId, [field]: doc._id });
  if (used) throw new HttpError(409, `This ${label} has work entries. Mark it inactive instead of deleting.`);
};

// ---------- Clients (+ summary) ----------
const clients = express.Router();

// Client-wise billing / received / outstanding for the list screen
clients.get('/summary', asyncHandler(async (req, res) => {
  const rows = await WorkEntry.aggregate([
    { $match: { businessId: req.businessId } },
    {
      $group: {
        _id: '$clientId',
        billed: { $sum: '$amount' },
        received: { $sum: '$received' },
        outstanding: { $sum: '$pendingAmount' },
        jobs: { $sum: 1 },
        lastWork: { $max: '$date' },
      },
    },
  ]);
  const map = {};
  rows.forEach((r) => { map[r._id] = r; });
  res.json(map);
}));

clients.get('/:id/history', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id');
  const client = await Client.findOne({ _id: req.params.id, businessId: req.businessId }).lean();
  if (!client) throw new HttpError(404, 'Client not found');
  const [work, payments] = await Promise.all([
    WorkEntry.find({ businessId: req.businessId, clientId: client._id })
      .populate('vehicleId', 'vehicleNumber').populate('driverId', 'name')
      .sort({ date: -1 }).limit(200).lean(),
    Payment.find({ businessId: req.businessId, clientId: client._id }).sort({ date: -1 }).limit(200).lean(),
  ]);
  res.json({ client, work, payments });
}));

clients.use('/', makeCrud(Client, {
  searchFields: ['name', 'contactPerson', 'phone', 'email'],
  sort: { name: 1 },
  beforeDelete: blockIfUsed('clientId', 'client'),
}));

// ---------- Vehicles ----------
const vehicles = makeCrud(Vehicle, {
  searchFields: ['vehicleNumber', 'type', 'model'],
  sort: { vehicleNumber: 1 },
  beforeDelete: blockIfUsed('vehicleId', 'vehicle'),
});

// ---------- Drivers ----------
const drivers = makeCrud(Driver, {
  searchFields: ['name', 'phone', 'employeeId'],
  sort: { name: 1 },
  beforeDelete: blockIfUsed('driverId', 'driver'),
});

// ---------- Expenses ----------
const expenses = express.Router();
expenses.get('/categories', (req, res) => res.json(Expense.CATEGORIES));
expenses.use('/', makeCrud(Expense, {
  searchFields: ['description', 'reference'],
  filterKeys: ['category', 'vehicleId', 'driverId'],
  dateField: 'date',
  refs: { vehicleId: [Vehicle, 'Vehicle'], driverId: [Driver, 'Driver'] },
  populate: [{ path: 'vehicleId', select: 'vehicleNumber' }, { path: 'driverId', select: 'name' }],
  sort: { date: -1, createdAt: -1 },
}));

module.exports = { clients, vehicles, drivers, expenses };
