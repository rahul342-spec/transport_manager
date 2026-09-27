// Reports (spec section 14). GET /api/reports/:type?from&to  (&format=csv to download)
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { parseRange, round2 } = require('../utils/calc');
const { toCSV } = require('../utils/csv');
const WorkEntry = require('../models/WorkEntry');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');

const router = express.Router();
const monthKey = { $dateToString: { format: '%Y-%m', date: '$date' } };
const r2 = (rows, keys) => rows.map((r) => {
  const o = { ...r };
  keys.forEach((k) => { o[k] = round2(o[k]); });
  return o;
});

const REPORTS = {
  'daily-work': {
    title: 'Daily work report',
    columns: [
      { key: 'date', label: 'Date', type: 'date' }, { key: 'client', label: 'Client' },
      { key: 'location', label: 'Location' }, { key: 'vehicle', label: 'Vehicle' },
      { key: 'driver', label: 'Driver' }, { key: 'time', label: 'Time' },
      { key: 'hours', label: 'Hours', type: 'number' }, { key: 'amount', label: 'Amount', type: 'money' },
      { key: 'received', label: 'Received', type: 'money' }, { key: 'pending', label: 'Pending', type: 'money' },
      { key: 'status', label: 'Status' },
    ],
    totals: ['hours', 'amount', 'received', 'pending'],
    async run(businessId, { from, to }) {
      const items = await WorkEntry.find({ businessId, date: { $gte: from, $lte: to } })
        .populate('clientId', 'name').populate('vehicleId', 'vehicleNumber').populate('driverId', 'name')
        .sort({ date: 1, startTime: 1 }).lean();
      return items.map((w) => ({
        date: w.date, client: w.clientId?.name, location: w.location, vehicle: w.vehicleId?.vehicleNumber,
        driver: w.driverId?.name, time: `${w.startTime}-${w.endTime}`, hours: w.hours,
        amount: w.amount, received: w.received, pending: w.pendingAmount, status: w.status,
      }));
    },
  },

  'monthly-revenue': {
    title: 'Monthly revenue report',
    columns: [
      { key: 'month', label: 'Month' }, { key: 'jobs', label: 'Jobs', type: 'number' },
      { key: 'revenue', label: 'Revenue', type: 'money' }, { key: 'received', label: 'Received on these jobs', type: 'money' },
      { key: 'pending', label: 'Pending', type: 'money' },
    ],
    totals: ['jobs', 'revenue', 'received', 'pending'],
    async run(businessId, { from, to }) {
      const rows = await WorkEntry.aggregate([
        { $match: { businessId, date: { $gte: from, $lte: to } } },
        { $group: { _id: monthKey, jobs: { $sum: 1 }, revenue: { $sum: '$amount' },
          received: { $sum: '$received' }, pending: { $sum: '$pendingAmount' } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, month: '$_id', jobs: 1, revenue: 1, received: 1, pending: 1 } },
      ]);
      return r2(rows, ['revenue', 'received', 'pending']);
    },
  },

  'monthly-expense': {
    title: 'Monthly expense report',
    columns: [
      { key: 'month', label: 'Month' },
      ...Expense.CATEGORIES.map((c) => ({ key: c, label: c, type: 'money' })),
      { key: 'total', label: 'Total', type: 'money' },
    ],
    totals: [...Expense.CATEGORIES, 'total'],
    async run(businessId, { from, to }) {
      const rows = await Expense.aggregate([
        { $match: { businessId, date: { $gte: from, $lte: to } } },
        { $group: { _id: { month: monthKey, category: '$category' }, total: { $sum: '$amount' } } },
      ]);
      const byMonth = {};
      rows.forEach(({ _id, total }) => {
        byMonth[_id.month] ||= { month: _id.month, total: 0, ...Object.fromEntries(Expense.CATEGORIES.map((c) => [c, 0])) };
        byMonth[_id.month][_id.category] += total;
        byMonth[_id.month].total += total;
      });
      return r2(Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)), [...Expense.CATEGORIES, 'total']);
    },
  },

  'profit-loss': {
    title: 'Monthly profit / loss',
    columns: [
      { key: 'month', label: 'Month' }, { key: 'revenue', label: 'Revenue', type: 'money' },
      { key: 'diesel', label: 'Diesel', type: 'money' }, { key: 'salary', label: 'Salary', type: 'money' },
      { key: 'other', label: 'Other expenses', type: 'money' }, { key: 'expenses', label: 'Total expenses', type: 'money' },
      { key: 'profit', label: 'Profit / Loss', type: 'money' },
    ],
    totals: ['revenue', 'diesel', 'salary', 'other', 'expenses', 'profit'],
    async run(businessId, { from, to }) {
      const [rev, exp] = await Promise.all([
        WorkEntry.aggregate([
          { $match: { businessId, date: { $gte: from, $lte: to } } },
          { $group: { _id: monthKey, revenue: { $sum: '$amount' } } },
        ]),
        Expense.aggregate([
          { $match: { businessId, date: { $gte: from, $lte: to } } },
          { $group: { _id: { month: monthKey, category: '$category' }, total: { $sum: '$amount' } } },
        ]),
      ]);
      const m = {};
      const get = (k) => (m[k] ||= { month: k, revenue: 0, diesel: 0, salary: 0, other: 0, expenses: 0, profit: 0 });
      rev.forEach((r) => { get(r._id).revenue = r.revenue; });
      exp.forEach(({ _id, total }) => {
        const row = get(_id.month);
        if (_id.category === 'Diesel') row.diesel += total;
        else if (_id.category === 'Salary') row.salary += total;
        else row.other += total;
        row.expenses += total;
      });
      Object.values(m).forEach((row) => { row.profit = row.revenue - row.expenses; });
      return r2(Object.values(m).sort((a, b) => a.month.localeCompare(b.month)),
        ['revenue', 'diesel', 'salary', 'other', 'expenses', 'profit']);
    },
  },

  'client-revenue': {
    title: 'Client-wise revenue',
    columns: [
      { key: 'client', label: 'Client' }, { key: 'jobs', label: 'Jobs', type: 'number' },
      { key: 'revenue', label: 'Billed', type: 'money' }, { key: 'received', label: 'Received', type: 'money' },
      { key: 'pending', label: 'Outstanding', type: 'money' },
    ],
    totals: ['jobs', 'revenue', 'received', 'pending'],
    async run(businessId, { from, to }) {
      const rows = await WorkEntry.aggregate([
        { $match: { businessId, date: { $gte: from, $lte: to } } },
        { $group: { _id: '$clientId', jobs: { $sum: 1 }, revenue: { $sum: '$amount' },
          received: { $sum: '$received' }, pending: { $sum: '$pendingAmount' } } },
        { $lookup: { from: 'clients', localField: '_id', foreignField: '_id', as: 'c' } },
        { $unwind: '$c' },
        { $sort: { revenue: -1 } },
        { $project: { _id: 0, client: '$c.name', jobs: 1, revenue: 1, received: 1, pending: 1 } },
      ]);
      return r2(rows, ['revenue', 'received', 'pending']);
    },
  },

  pending: {
    title: 'Pending payment report',
    ignoresRange: true,
    columns: [
      { key: 'client', label: 'Client' }, { key: 'phone', label: 'Phone' },
      { key: 'date', label: 'Work date', type: 'date' }, { key: 'location', label: 'Location' },
      { key: 'invoice', label: 'Invoice' }, { key: 'dueDate', label: 'Due date', type: 'date' },
      { key: 'amount', label: 'Amount', type: 'money' }, { key: 'received', label: 'Received', type: 'money' },
      { key: 'pending', label: 'Pending', type: 'money' }, { key: 'reminder', label: 'Reminder' },
    ],
    totals: ['amount', 'received', 'pending'],
    async run(businessId) {
      const items = await WorkEntry.find({ businessId, pendingAmount: { $gt: 0 } })
        .populate('clientId', 'name phone').populate('invoiceId', 'invoiceNumber')
        .sort({ date: 1 }).lean();
      return items.map((w) => ({
        client: w.clientId?.name, phone: w.clientId?.phone, date: w.date, location: w.location,
        invoice: w.invoiceId?.invoiceNumber || '', dueDate: w.dueDate, amount: w.amount,
        received: w.received, pending: w.pendingAmount, reminder: w.reminderStatus,
      }));
    },
  },

  vehicle: {
    title: 'Vehicle-wise work & revenue',
    columns: [
      { key: 'vehicle', label: 'Vehicle' }, { key: 'jobs', label: 'Jobs', type: 'number' },
      { key: 'hours', label: 'Hours', type: 'number' }, { key: 'revenue', label: 'Revenue', type: 'money' },
      { key: 'expenses', label: 'Vehicle expenses', type: 'money' }, { key: 'net', label: 'Net', type: 'money' },
    ],
    totals: ['jobs', 'hours', 'revenue', 'expenses', 'net'],
    async run(businessId, { from, to }) {
      const [work, exp] = await Promise.all([
        WorkEntry.aggregate([
          { $match: { businessId, date: { $gte: from, $lte: to } } },
          { $group: { _id: '$vehicleId', jobs: { $sum: 1 }, hours: { $sum: '$hours' }, revenue: { $sum: '$amount' } } },
        ]),
        Expense.aggregate([
          { $match: { businessId, date: { $gte: from, $lte: to }, vehicleId: { $ne: null } } },
          { $group: { _id: '$vehicleId', expenses: { $sum: '$amount' } } },
        ]),
      ]);
      const Vehicle = require('../models/Vehicle');
      const vehicles = await Vehicle.find({ businessId }).lean();
      const w = Object.fromEntries(work.map((x) => [String(x._id), x]));
      const e = Object.fromEntries(exp.map((x) => [String(x._id), x.expenses]));
      return r2(vehicles
        .map((v) => {
          const k = String(v._id);
          const revenue = w[k]?.revenue || 0;
          const expenses = e[k] || 0;
          return { vehicle: v.vehicleNumber, jobs: w[k]?.jobs || 0, hours: w[k]?.hours || 0, revenue, expenses, net: revenue - expenses };
        })
        .filter((r) => r.jobs || r.expenses)
        .sort((a, b) => b.revenue - a.revenue), ['hours', 'revenue', 'expenses', 'net']);
    },
  },

  driver: {
    title: 'Driver-wise work & revenue',
    columns: [
      { key: 'driver', label: 'Driver' }, { key: 'jobs', label: 'Jobs', type: 'number' },
      { key: 'hours', label: 'Hours', type: 'number' }, { key: 'revenue', label: 'Revenue', type: 'money' },
      { key: 'salary', label: 'Salary paid', type: 'money' },
    ],
    totals: ['jobs', 'hours', 'revenue', 'salary'],
    async run(businessId, { from, to }) {
      const [work, sal] = await Promise.all([
        WorkEntry.aggregate([
          { $match: { businessId, date: { $gte: from, $lte: to } } },
          { $group: { _id: '$driverId', jobs: { $sum: 1 }, hours: { $sum: '$hours' }, revenue: { $sum: '$amount' } } },
        ]),
        Expense.aggregate([
          { $match: { businessId, date: { $gte: from, $lte: to }, category: 'Salary', driverId: { $ne: null } } },
          { $group: { _id: '$driverId', salary: { $sum: '$amount' } } },
        ]),
      ]);
      const Driver = require('../models/Driver');
      const drivers = await Driver.find({ businessId }).lean();
      const w = Object.fromEntries(work.map((x) => [String(x._id), x]));
      const s = Object.fromEntries(sal.map((x) => [String(x._id), x.salary]));
      return r2(drivers
        .map((d) => {
          const k = String(d._id);
          return { driver: d.name, jobs: w[k]?.jobs || 0, hours: w[k]?.hours || 0, revenue: w[k]?.revenue || 0, salary: s[k] || 0 };
        })
        .filter((r) => r.jobs || r.salary)
        .sort((a, b) => b.revenue - a.revenue), ['hours', 'revenue', 'salary']);
    },
  },

  payments: {
    title: 'Payments received',
    columns: [
      { key: 'date', label: 'Date', type: 'date' }, { key: 'client', label: 'Client' },
      { key: 'method', label: 'Method' }, { key: 'reference', label: 'Reference' },
      { key: 'amount', label: 'Amount', type: 'money' },
    ],
    totals: ['amount'],
    async run(businessId, { from, to }) {
      const items = await Payment.find({ businessId, date: { $gte: from, $lte: to } })
        .populate('clientId', 'name').sort({ date: 1 }).lean();
      return items.map((p) => ({ date: p.date, client: p.clientId?.name, method: p.method, reference: p.reference, amount: p.amount }));
    },
  },
};

router.get('/', (req, res) => {
  res.json(Object.entries(REPORTS).map(([key, r]) => ({ key, title: r.title, ignoresRange: !!r.ignoresRange })));
});

router.get('/:type', asyncHandler(async (req, res) => {
  const report = REPORTS[req.params.type];
  if (!report) throw new HttpError(404, 'Unknown report');
  const range = parseRange(req.query);
  const rows = await report.run(req.businessId, range);

  const totals = {};
  (report.totals || []).forEach((k) => { totals[k] = round2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)); });

  if (req.query.format === 'csv') {
    const firstKey = report.columns[0].key;
    const csvRows = rows.length ? [...rows, { [firstKey]: 'TOTAL', ...totals }] : rows;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}.csv"`);
    return res.send(`\uFEFF${toCSV(report.columns, csvRows)}`); // BOM so Excel reads UTF-8
  }
  res.json({ title: report.title, columns: report.columns, rows, totals, range });
}));

module.exports = router;
