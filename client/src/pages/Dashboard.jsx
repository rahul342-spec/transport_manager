import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { date, money, moneyShort, monthLabel } from '../lib/format';
import { defaultPeriod, periodParams } from '../lib/period';
import { Badge, ErrorBox, Loading, PageHeader, PeriodPicker } from '../components/ui';

function Stat({ label, value, tone, sub }) {
  const color = tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-asphalt';
  return (
    <div className="card px-4 py-3.5">
      <div className="text-sm text-asphalt-500">{label}</div>
      <div className={`num mt-0.5 text-2xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[13px] text-asphalt-300">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [period, setPeriod] = useState(defaultPeriod);
  const { data, loading, error } = useApi(`/dashboard${qs(periodParams(period))}`);
  const k = data?.kpis;
  const loss = k && k.netProfit < 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <>
            <PeriodPicker value={period} onChange={setPeriod} />
            <Link to="/work?new=1" className="btn-primary">Add daily work</Link>
          </>
        }
      />
      <ErrorBox>{error}</ErrorBox>
      {loading && !data ? <Loading /> : k && (
        <>
          {/* The one loud element: profit on a sign board */}
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <section
              className={`rounded-xl px-6 py-5 ${loss ? 'bg-loss text-white' : 'bg-sign text-asphalt'}`}
              aria-label="Net profit or loss"
            >
              <div className="text-[15px] font-semibold opacity-80">{loss ? 'Net loss' : 'Net profit'} for this period</div>
              <div className="num mt-1 text-5xl font-bold sm:text-6xl">{money(Math.abs(k.netProfit))}</div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[15px] font-medium">
                <span>Revenue <span className="num text-lg">{money(k.revenue)}</span></span>
                <span>Expenses <span className="num text-lg">{money(k.totalExpenses)}</span></span>
              </div>
            </section>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Payment received" value={money(k.received)} tone="gain" />
              <Stat label="Still to collect" value={money(k.pendingTotal)} tone={k.pendingTotal > 0 ? 'loss' : undefined}
                sub={`${k.pendingCount} job${k.pendingCount === 1 ? '' : 's'}, all time`} />
              <Stat label="Jobs / trips" value={k.jobs} />
              <Stat label="Hours worked" value={k.hours} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Diesel" value={money(k.diesel)} />
            <Stat label="Salaries" value={money(k.salary)} />
            <Stat label="Other expenses" value={money(k.otherExpenses)} />
            <Stat label="Pending from this period" value={money(k.pendingInPeriod)} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <section className="card p-4">
              <h2 className="font-display text-lg font-semibold">Revenue vs expenses, last 6 months</h2>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.trend} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid stroke="#EEF1F4" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 12, fill: '#4B5B68' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={moneyShort} tick={{ fontSize: 12, fill: '#4B5B68' }} axisLine={false} tickLine={false} width={56} />
                    <Tooltip formatter={(v) => money(v)} labelFormatter={monthLabel} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#1F2A33" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="expense" name="Expenses" fill="#8A99A6" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Line dataKey="profit" name="Profit / loss" stroke="#F2A900" strokeWidth={3} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card p-4">
              <h2 className="font-display text-lg font-semibold">Where the money went</h2>
              <ul className="mt-4 space-y-3">
                {data.expenseBreakdown.map((e) => {
                  const pct = k.totalExpenses ? (e.amount / k.totalExpenses) * 100 : 0;
                  return (
                    <li key={e.category}>
                      <div className="flex justify-between text-[15px]">
                        <span>{e.category}</span>
                        <span className="num">{money(e.amount)}</span>
                      </div>
                      <div className="mt-1 h-2 rounded bg-lane">
                        <div className="h-2 rounded bg-asphalt" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="card">
              <div className="flex items-center justify-between px-4 pt-4">
                <h2 className="font-display text-lg font-semibold">Payment reminders</h2>
                <Link to="/payments?tab=pending" className="text-sm font-semibold underline">See all</Link>
              </div>
              {data.pendingByClient.length === 0 ? (
                <p className="px-4 py-8 text-center text-asphalt-500">Nothing pending. Every client has paid.</p>
              ) : (
                <ul className="mt-2">
                  {data.pendingByClient.map((p) => (
                    <li key={p._id} className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.clientName}</div>
                        <div className="text-[13px] text-asphalt-500">
                          {p.jobs} job{p.jobs === 1 ? '' : 's'} · oldest {date(p.oldest)}
                          {p.phone ? <> · <a className="underline" href={`tel:${p.phone}`}>{p.phone}</a></> : null}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="num text-lg font-semibold text-loss">{money(p.pending)}</div>
                        {p.overdue && <Badge tone="Overdue">Overdue</Badge>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <div className="flex items-center justify-between px-4 pt-4">
                <h2 className="font-display text-lg font-semibold">Latest work</h2>
                <Link to="/work" className="text-sm font-semibold underline">See all</Link>
              </div>
              {data.recentWork.length === 0 ? (
                <p className="px-4 py-8 text-center text-asphalt-500">No work recorded yet.</p>
              ) : (
                <ul className="mt-2">
                  {data.recentWork.map((w) => (
                    <li key={w._id} className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{w.clientId?.name}</div>
                        <div className="text-[13px] text-asphalt-500">{date(w.date)} · {w.location} · {w.vehicleId?.vehicleNumber}</div>
                      </div>
                      <div className="text-right">
                        <div className="num text-lg">{money(w.amount)}</div>
                        <Badge>{w.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
