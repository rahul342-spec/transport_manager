import { isoMonth, isoDay, monthBounds } from './format';

export const defaultPeriod = () => {
  const month = isoMonth();
  const { from } = monthBounds(month);
  return { mode: 'month', month, from, to: isoDay() };
};

// -> { from, to } query params
export const periodParams = (p) => (p.mode === 'month' ? monthBounds(p.month) : { from: p.from, to: p.to });
