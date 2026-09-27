// Payment module (spec section 8)
const express = require('express');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { assertOwned, cleanBody } = require('../services/tenant');
const { syncWorkEntry } = require('../services/payments');
const Payment = require('../models/Payment');
const WorkEntry = require('../models/WorkEntry');
const Client = require('../models/Client');

const router = express.Router();
const str = (v) => (typeof v === 'string' ? v : '');
const POPULATE = [
  { path: 'clientId', select: 'name' },
  { path: 'workEntryId', select: 'date location amount' },
  { path: 'invoiceId', select: 'invoiceNumber' },
];

async function findOwned(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id');
  const doc = await Payment.findOne({ _id: req.params.id, businessId: req.businessId });
  if (!doc) throw new HttpError(404, 'Payment not found');
  return doc;
}

router.get('/', asyncHandler(async (req, res) => {
  const filter = { businessId: req.businessId };
  ['clientId', 'workEntryId', 'method'].forEach((k) => {
    if (str(req.query[k])) filter[k] = req.query[k];
  });
  if (str(req.query.from) || str(req.query.to)) {
    filter.date = {};
    if (str(req.query.from)) filter.date.$gte = new Date(req.query.from);
    if (str(req.query.to)) {
      const end = new Date(req.query.to);
      end.setUTCHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [items, total, sum] = await Promise.all([
    Payment.find(filter).populate(POPULATE).sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $match: filter }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1, totals: { amount: sum[0]?.amount || 0 } });
}));

// Pending payments / reminders (spec section 13) — outstanding work entries, oldest first
router.get('/pending', asyncHandler(async (req, res) => {
  const filter = { businessId: req.businessId, pendingAmount: { $gt: 0 } };
  if (str(req.query.clientId)) filter.clientId = req.query.clientId;
  const items = await WorkEntry.find(filter)
    .populate([{ path: 'clientId', select: 'name phone' }, { path: 'invoiceId', select: 'invoiceNumber dueDate' }])
    .sort({ dueDate: 1, date: 1 }).limit(500).lean();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  items.forEach((w) => {
    const due = w.dueDate || w.invoiceId?.dueDate;
    w.effectiveDueDate = due || null;
    w.overdue = due ? new Date(due) < today : false;
    w.daysOld = Math.floor((today - new Date(w.date)) / 86400000);
  });
  res.json(items);
}));

async function validateLink(body, businessId) {
  await assertOwned(Client, body.clientId, businessId, 'Client');
  if (!body.workEntryId) return null;
  const work = await assertOwned(WorkEntry, body.workEntryId, businessId, 'Work entry');
  if (String(work.clientId) !== String(body.clientId)) {
    throw new HttpError(400, 'This work entry belongs to a different client');
  }
  return work;
}

router.post('/', asyncHandler(async (req, res) => {
  const body = cleanBody(req.body);
  if (!body.workEntryId) delete body.workEntryId;
  if (!body.invoiceId) delete body.invoiceId;
  if (body.invoiceId) await assertOwned(require('../models/Invoice'), body.invoiceId, req.businessId, 'Invoice');
  const work = await validateLink(body, req.businessId);

  if (work && Number(body.amount) > work.pendingAmount + 0.001) {
    throw new HttpError(400, `Only ${work.pendingAmount} is pending on this work entry`);
  }
  if (work && !body.invoiceId && work.invoiceId) body.invoiceId = work.invoiceId;

  const payment = await Payment.create({ ...body, businessId: req.businessId });
  await syncWorkEntry(payment.workEntryId, req.businessId);
  await payment.populate(POPULATE);
  res.status(201).json(payment);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const payment = await findOwned(req);
  // Only amount/date/method/reference/notes are editable; the link stays fixed
  const body = cleanBody(req.body, ['clientId', 'workEntryId', 'invoiceId']);

  if (payment.workEntryId && body.amount !== undefined) {
    const work = await WorkEntry.findOne({ _id: payment.workEntryId, businessId: req.businessId });
    const maxAllowed = work.pendingAmount + payment.amount;
    if (Number(body.amount) > maxAllowed + 0.001) {
      throw new HttpError(400, `Amount cannot exceed ${maxAllowed} for this work entry`);
    }
  }
  payment.set(body);
  await payment.save();
  await syncWorkEntry(payment.workEntryId, req.businessId);
  await payment.populate(POPULATE);
  res.json(payment);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const payment = await findOwned(req);
  const workId = payment.workEntryId;
  await payment.deleteOne();
  await syncWorkEntry(workId, req.businessId);
  res.json({ ok: true });
}));

module.exports = router;
