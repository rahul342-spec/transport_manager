// Core business calculations (spec section 15)

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// "HH:mm" -> hours. Handles work that crosses midnight (e.g. 22:00 -> 02:00).
function totalHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return round2(mins / 60);
}

function pending(amount, received) {
  return round2(Math.max((Number(amount) || 0) - (Number(received) || 0), 0));
}

// Paid if pending = 0; Partial if received > 0 and pending > 0; Pending if received = 0
function paymentStatus(amount, received) {
  const due = pending(amount, received);
  if (due === 0) return 'Paid';
  if ((Number(received) || 0) > 0) return 'Partial';
  return 'Pending';
}

// Dates are stored as UTC midnight of the work day.
function monthRange(year, month /* 1-12 */) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { from, to };
}

// Accepts ?from=YYYY-MM-DD&to=YYYY-MM-DD or ?month=YYYY-MM. Defaults to current month.
function parseRange(query = {}) {
  if (query.from || query.to) {
    const from = query.from ? new Date(query.from) : new Date(Date.UTC(2000, 0, 1));
    const to = query.to ? new Date(query.to) : new Date();
    to.setUTCHours(23, 59, 59, 999);
    return { from, to };
  }
  if (query.month) {
    const [y, m] = String(query.month).split('-').map(Number);
    return monthRange(y, m);
  }
  const now = new Date();
  return monthRange(now.getUTCFullYear(), now.getUTCMonth() + 1);
}

module.exports = { round2, totalHours, pending, paymentStatus, monthRange, parseRange };
