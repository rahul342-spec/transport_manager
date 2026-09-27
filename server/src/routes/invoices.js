// Invoice module (spec section 12)
const express = require('express');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { assertOwned } = require('../services/tenant');
const { round2 } = require('../utils/calc');
const { streamInvoicePdf } = require('../services/invoicePdf');
const Invoice = require('../models/Invoice');
const WorkEntry = require('../models/WorkEntry');
const Payment = require('../models/Payment');
const Business = require('../models/Business');
const Client = require('../models/Client');

const router = express.Router();
const str = (v) => (typeof v === 'string' ? v : '');

// Payments are recorded against work amounts (pre-GST). The invoice's received
// figure scales that to the GST-inclusive total, so a fully paid job = fully paid invoice.
async function withPaymentStatus(invoices, businessId) {
  const ids = invoices.flatMap((i) => i.workEntryIds).map((x) => x?._id || x);
  const agg = await Payment.aggregate([
    { $match: { businessId, workEntryId: { $in: ids } } },
    { $group: { _id: '$workEntryId', total: { $sum: '$amount' } } },
  ]);
  const byWork = Object.fromEntries(agg.map((a) => [String(a._id), a.total]));
  return invoices.map((inv) => {
    const workPaid = inv.workEntryIds.reduce((s, id) => s + (byWork[String(id?._id || id)] || 0), 0);
    const ratio = inv.subtotal > 0 ? Math.min(workPaid / inv.subtotal, 1) : 1;
    const received = round2(inv.total * ratio);
    const balance = round2(Math.max(inv.total - received, 0));
    const status = balance === 0 ? 'Paid' : received > 0 ? 'Partial' : 'Pending';
    return { ...inv, received, balance, status };
  });
}

async function findOwned(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id');
  const inv = await Invoice.findOne({ _id: req.params.id, businessId: req.businessId });
  if (!inv) throw new HttpError(404, 'Invoice not found');
  return inv;
}

router.get('/', asyncHandler(async (req, res) => {
  const filter = { businessId: req.businessId };
  if (str(req.query.clientId)) filter.clientId = req.query.clientId;
  if (str(req.query.from) || str(req.query.to)) {
    filter.date = {};
    if (str(req.query.from)) filter.date.$gte = new Date(req.query.from);
    if (str(req.query.to)) {
      const end = new Date(req.query.to);
      end.setUTCHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }
  const items = await Invoice.find(filter).populate('clientId', 'name').sort({ date: -1, createdAt: -1 }).limit(500).lean();
  res.json({ items: await withPaymentStatus(items, req.businessId) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const inv = await findOwned(req);
  await inv.populate([
    { path: 'clientId' },
    { path: 'workEntryIds', populate: { path: 'vehicleId', select: 'vehicleNumber' } },
  ]);
  const [withStatus] = await withPaymentStatus([inv.toObject()], req.businessId);
  res.json(withStatus);
}));

// POST { clientId, workEntryIds[], date, dueDate?, gstPercent?, notes? }
router.post('/', asyncHandler(async (req, res) => {
  const { clientId, workEntryIds, date, dueDate, notes } = req.body;
  await assertOwned(Client, clientId, req.businessId, 'Client');

  if (!Array.isArray(workEntryIds) || workEntryIds.length === 0) {
    throw new HttpError(400, 'Select at least one work entry');
  }
  if (!workEntryIds.every((id) => mongoose.isValidObjectId(id))) throw new HttpError(400, 'Invalid work entry');

  const works = await WorkEntry.find({ _id: { $in: workEntryIds }, businessId: req.businessId });
  if (works.length !== workEntryIds.length) throw new HttpError(400, 'Some work entries were not found');
  if (works.some((w) => String(w.clientId) !== String(clientId))) {
    throw new HttpError(400, 'All work entries must belong to the selected client');
  }
  if (works.some((w) => w.invoiceId)) throw new HttpError(409, 'Some work entries are already invoiced');

  const business = await Business.findById(req.businessId);
  const gstPercent = req.body.gstPercent !== undefined && req.body.gstPercent !== ''
    ? Number(req.body.gstPercent) : business.defaultGstPercent;
  const subtotal = round2(works.reduce((s, w) => s + w.amount, 0));
  const gstAmount = round2((subtotal * gstPercent) / 100);

  // Atomic per-business counter -> INV-0001, INV-0002 ...
  const { invoiceSeq, invoicePrefix } = await Business.findByIdAndUpdate(
    req.businessId, { $inc: { invoiceSeq: 1 } }, { new: true }
  );
  const invoiceNumber = `${invoicePrefix || 'INV'}-${String(invoiceSeq).padStart(4, '0')}`;

  const invDate = date ? new Date(date) : new Date();
  const due = dueDate
    ? new Date(dueDate)
    : new Date(invDate.getTime() + (business.paymentTermsDays || 0) * 86400000);

  const invoice = await Invoice.create({
    businessId: req.businessId,
    invoiceNumber,
    date: invDate,
    dueDate: due,
    clientId,
    workEntryIds,
    subtotal,
    gstPercent,
    gstAmount,
    total: round2(subtotal + gstAmount),
    notes,
  });

  await WorkEntry.updateMany(
    { _id: { $in: workEntryIds }, businessId: req.businessId },
    { $set: { invoiceId: invoice._id } }
  );
  // Due date feeds payment reminders if the work entry doesn't have its own
  await WorkEntry.updateMany(
    { _id: { $in: workEntryIds }, businessId: req.businessId, dueDate: { $exists: false } },
    { $set: { dueDate: due } }
  );

  res.status(201).json(invoice);
}));

router.get('/:id/pdf', asyncHandler(async (req, res) => {
  const invoice = await findOwned(req);
  const [business, client, works] = await Promise.all([
    Business.findById(req.businessId).lean(),
    Client.findOne({ _id: invoice.clientId, businessId: req.businessId }).lean(),
    WorkEntry.find({ _id: { $in: invoice.workEntryIds }, businessId: req.businessId })
      .populate('vehicleId', 'vehicleNumber').sort({ date: 1 }).lean(),
  ]);
  const [{ received }] = await withPaymentStatus([invoice.toObject()], req.businessId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
  streamInvoicePdf(res, { invoice, business, client, works, paid: received });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const invoice = await findOwned(req);
  await WorkEntry.updateMany(
    { invoiceId: invoice._id, businessId: req.businessId },
    { $unset: { invoiceId: 1 } }
  );
  await Payment.updateMany({ invoiceId: invoice._id, businessId: req.businessId }, { $unset: { invoiceId: 1 } });
  await invoice.deleteOne();
  res.json({ ok: true });
}));

module.exports = router;
