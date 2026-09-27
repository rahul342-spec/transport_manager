// Dashboard KPIs (spec section 5)
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { parseRange, round2 } = require('../utils/calc');
const WorkEntry = require('../models/WorkEntry');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const businessId = req.businessId;
  const { from, to } = parseRange(req.query);
  const inRange = { $gte: from, $lte: to };

  // Trend window: 6 months ending with the selected period's month
  const trendFrom = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1));

  const [work, received, expenses, pendingAll, trendWork, trendExp, pendingByClient, recent] = await Promise.all([
    WorkEntry.aggregate([
      { $match: { businessId, date: inRange } },
      { $group: { _id: null, revenue: { $sum: '$amount' }, jobs: { $sum: 1 }, hours: { $sum: '$hours' },
        pending: { $sum: '$pendingAmount' } } },
    ]),
    Payment.aggregate([
      { $match: { businessId, date: inRange } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: { businessId, date: inRange } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ]),
    WorkEntry.aggregate([
      { $match: { businessId, pendingAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$pendingAmount' }, count: { $sum: 1 } } },
    ]),
    WorkEntry.aggregate([
      { $match: { businessId, date: { $gte: trendFrom, $lte: to } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, revenue: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: { businessId, date: { $gte: trendFrom, $lte: to } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, expense: { $sum: '$amount' } } },
    ]),
    WorkEntry.aggregate([
      { $match: { businessId, pendingAmount: { $gt: 0 } } },
      { $group: { _id: '$clientId', pending: { $sum: '$pendingAmount' }, jobs: { $sum: 1 },
        oldest: { $min: '$date' }, nextDue: { $min: '$dueDate' } } },
      { $sort: { pending: -1 } },
      { $limit: 8 },
      { $lookup: { from: 'clients', localField: '_id', foreignField: '_id', as: 'client' } },
      { $unwind: '$client' },
      { $project: { pending: 1, jobs: 1, oldest: 1, nextDue: 1, clientName: '$client.name', phone: '$client.phone' } },
    ]),
    WorkEntry.find({ businessId }).sort({ date: -1, createdAt: -1 }).limit(6)
      .populate('clientId', 'name').populate('vehicleId', 'vehicleNumber').lean(),
  ]);

  const byCat = Object.fromEntries(expenses.map((e) => [e._id, e.total]));
  const diesel = byCat.Diesel || 0;
  const salary = byCat.Salary || 0;
  const totalExpenses = expenses.reduce((s, e) => s + e.total, 0);
  const other = totalExpenses - diesel - salary;
  const revenue = work[0]?.revenue || 0;

  // Build a continuous 6-month series (months with no data show 0)
  const tw = Object.fromEntries(trendWork.map((t) => [t._id, t.revenue]));
  const te = Object.fromEntries(trendExp.map((t) => [t._id, t.expense]));
  const trend = [];
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(Date.UTC(trendFrom.getUTCFullYear(), trendFrom.getUTCMonth() + i, 1));
    const key = d.toISOString().slice(0, 7);
    const r = tw[key] || 0;
    const e = te[key] || 0;
    trend.push({ month: key, revenue: round2(r), expense: round2(e), profit: round2(r - e) });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  res.json({
    range: { from, to },
    kpis: {
      revenue: round2(revenue),
      received: round2(received[0]?.total || 0),
      pendingInPeriod: round2(work[0]?.pending || 0),
      pendingTotal: round2(pendingAll[0]?.total || 0),
      pendingCount: pendingAll[0]?.count || 0,
      diesel: round2(diesel),
      salary: round2(salary),
      otherExpenses: round2(other),
      totalExpenses: round2(totalExpenses),
      netProfit: round2(revenue - totalExpenses),
      jobs: work[0]?.jobs || 0,
      hours: round2(work[0]?.hours || 0),
    },
    expenseBreakdown: Expense.CATEGORIES.map((c) => ({ category: c, amount: round2(byCat[c] || 0) })),
    trend,
    pendingByClient: pendingByClient.map((p) => ({
      ...p,
      overdue: p.nextDue ? new Date(p.nextDue) < today : false,
    })),
    recentWork: recent,
  });
}));

module.exports = router;
