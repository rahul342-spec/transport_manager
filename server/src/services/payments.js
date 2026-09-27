const Payment = require('../models/Payment');
const WorkEntry = require('../models/WorkEntry');

// Re-sums all payments for a work entry and saves received / pending / status.
async function syncWorkEntry(workEntryId, businessId) {
  if (!workEntryId) return null;
  const work = await WorkEntry.findOne({ _id: workEntryId, businessId });
  if (!work) return null;

  const [agg] = await Payment.aggregate([
    { $match: { businessId: work.businessId, workEntryId: work._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  work.received = agg ? agg.total : 0;
  await work.save(); // pre-save hook recalculates pending + status
  return work;
}

module.exports = { syncWorkEntry };
