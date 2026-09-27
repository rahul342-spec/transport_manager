// Daily Work / Trip module (spec section 6)
const express = require('express');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { assertOwned, cleanBody } = require('../services/tenant');
const { syncWorkEntry } = require('../services/payments');
const WorkEntry = require('../models/WorkEntry');
const Payment = require('../models/Payment');
const Client = require('../models/Client');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');

const router = express.Router();
const POPULATE = [
  { path: 'clientId', select: 'name phone' },
  { path: 'vehicleId', select: 'vehicleNumber type' },
  { path: 'driverId', select: 'name phone' },
  { path: 'invoiceId', select: 'invoiceNumber' },
];
const str = (v) => (typeof v === 'string' ? v : '');

async function checkRefs(body, businessId) {
  await assertOwned(Client, body.clientId, businessId, 'Client');
  await assertOwned(Vehicle, body.vehicleId, businessId, 'Vehicle');
  await assertOwned(Driver, body.driverId, businessId, 'Driver');
}

async function findOwned(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id');
  const doc = await WorkEntry.findOne({ _id: req.params.id, businessId: req.businessId });
  if (!doc) throw new HttpError(404, 'Work entry not found');
  return doc;
}

// GET /api/work?from&to&clientId&vehicleId&driverId&status&invoiced=false&q
router.get('/', asyncHandler(async (req, res) => {
  const filter = { businessId: req.businessId };
  ['clientId', 'vehicleId', 'driverId', 'status'].forEach((k) => {
    if (str(req.query[k])) filter[k] = req.query[k];
  });
  if (req.query.invoiced === 'false') filter.invoiceId = { $exists: false };
  if (req.query.pendingOnly === 'true') filter.pendingAmount = { $gt: 0 };
  if (str(req.query.from) || str(req.query.to)) {
    filter.date = {};
    if (str(req.query.from)) filter.date.$gte = new Date(req.query.from);
    if (str(req.query.to)) {
      const end = new Date(req.query.to);
      end.setUTCHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }
  if (str(req.query.q)) {
    filter.$or = [
      { location: new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { notes: new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    ];
  }

  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [items, total, totals] = await Promise.all([
    WorkEntry.find(filter).populate(POPULATE).sort({ date: -1, startTime: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    WorkEntry.countDocuments(filter),
    WorkEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          amount: { $sum: '$amount' },
          received: { $sum: '$received' },
          pending: { $sum: '$pendingAmount' },
          hours: { $sum: '$hours' },
        },
      },
    ]),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1, totals: totals[0] || {} });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await findOwned(req);
  await doc.populate(POPULATE);
  const payments = await Payment.find({ businessId: req.businessId, workEntryId: doc._id }).sort({ date: -1 }).lean();
  res.json({ ...doc.toObject(), payments });
}));

// Create. "received" on the form becomes a real Payment record so the payments
// ledger and the work entry always agree.
router.post('/', asyncHandler(async (req, res) => {
  const body = cleanBody(req.body, ['received', 'pendingAmount', 'status', 'hours', 'invoiceId']);
  await checkRefs(body, req.businessId);

  const initialReceived = Number(req.body.received) || 0;
  if (initialReceived < 0) throw new HttpError(400, 'Payment received cannot be negative');
  if (initialReceived > Number(body.amount)) {
    throw new HttpError(400, 'Payment received cannot be more than the job amount');
  }

  const work = await WorkEntry.create({ ...body, businessId: req.businessId });

  if (initialReceived > 0) {
    await Payment.create({
      businessId: req.businessId,
      clientId: work.clientId,
      workEntryId: work._id,
      amount: initialReceived,
      date: work.date,
      method: req.body.paymentMethod || 'Cash',
      notes: 'Received with work entry',
    });
    await syncWorkEntry(work._id, req.businessId);
  }

  const saved = await WorkEntry.findById(work._id).populate(POPULATE);
  res.status(201).json(saved);
}));

// Update. Received amount changes only through the Payments module.
router.put('/:id', asyncHandler(async (req, res) => {
  const work = await findOwned(req);
  const body = cleanBody(req.body, ['received', 'pendingAmount', 'status', 'hours', 'invoiceId']);

  // Client can't change once payments/invoice exist — would orphan them
  if (body.clientId && String(body.clientId) !== String(work.clientId)) {
    const hasPayments = await Payment.exists({ businessId: req.businessId, workEntryId: work._id });
    if (hasPayments || work.invoiceId) {
      throw new HttpError(409, 'Client cannot be changed after payments or an invoice are recorded');
    }
  }
  await checkRefs({ ...work.toObject(), ...body }, req.businessId);

  if (body.amount !== undefined && Number(body.amount) < work.received) {
    throw new HttpError(400, `Amount cannot be less than already received (${work.received})`);
  }
  work.set(body);
  await work.save();
  await work.populate(POPULATE);
  res.json(work);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const work = await findOwned(req);
  if (work.invoiceId) throw new HttpError(409, 'This work is on an invoice. Delete the invoice first.');
  const { deletedCount } = await Payment.deleteMany({ businessId: req.businessId, workEntryId: work._id });
  await work.deleteOne();
  res.json({ ok: true, paymentsDeleted: deletedCount });
}));

module.exports = router;
