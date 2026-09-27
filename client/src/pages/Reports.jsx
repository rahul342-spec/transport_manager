import { useState } from 'react';
import { downloadFile, qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { date, isoMonth, money, monthBounds, monthLabel } from '../lib/format';
import { Empty, ErrorBox, Loading, PageHeader, Table, useToast } from '../components/ui';

const cell = (col, v) => {
  if (col.type === 'money') return money(v);
  if (col.type === 'date') return date(v);
  if (col.key === 'month') return monthLabel(v);
  return v ?? '–';
};

const yearStart = () => `${new Date().getFullYear()}-01-01`;

export default function Reports() {
  const toast = useToast();
  const { data: list } = useApi('/reports');
  const [type, setType] = useState('profit-loss');
  const [range, setRange] = useState({ from: yearStart(), to: monthBounds(isoMonth()).to });
  const params = { from: range.from, to: range.to };
  const { data, loading, error } = useApi(`/reports/${type}${qs(params)}`);
  const meta = list?.find((r) => r.key === type);

  const exportCsv = async () => {
    try {
      await downloadFile(`/reports/${type}${qs({ ...params, format: 'csv' })}`, `${type}_${range.from}_to_${range.to}.csv`);
    } catch (e) { toast(e.message, 'error'); }
  };

  const setPreset = (preset) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const pad = (n) => String(n).padStart(2, '0');
    const last = (yy, mm) => new Date(yy, mm + 1, 0).getDate();
    if (preset === 'this-month') setRange({ from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${last(y, m)}` });
    if (preset === 'last-month') {
      const d = new Date(y, m - 1, 1);
      setRange({ from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, to: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${last(d.getFullYear(), d.getMonth())}` });
    }
    if (preset === 'this-year') setRange({ from: `${y}-01-01`, to: `${y}-12-31` });
    // Indian financial year: April to March
    if (preset === 'fy') {
      const fyStart = m >= 3 ? y : y - 1;
      setRange({ from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` });
    }
  };

  return (
    <>
      <PageHeader title="Reports" subtitle="Pick a report and a period. Export to open it in Excel." />

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <nav className="card h-fit p-2" aria-label="Reports">
          {(list || []).map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setType(r.key)}
              className={`block w-full rounded-md px-3 py-2 text-left text-[15px] ${type === r.key ? 'bg-asphalt font-semibold text-white' : 'hover:bg-lane'}`}
            >
              {r.title}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
            {meta?.ignoresRange ? (
              <span className="text-asphalt-500">Shows everything outstanding right now.</span>
            ) : (
              <>
                <input type="date" className="input w-auto" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="From" />
                <span className="text-asphalt-300">to</span>
                <input type="date" className="input w-auto" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="To" />
                <select className="input w-auto" value="" onChange={(e) => setPreset(e.target.value)} aria-label="Quick range">
                  <option value="">Quick pick…</option>
                  <option value="this-month">This month</option>
                  <option value="last-month">Last month</option>
                  <option value="this-year">This calendar year</option>
                  <option value="fy">This financial year (Apr–Mar)</option>
                </select>
              </>
            )}
            <button type="button" className="btn-dark ml-auto" onClick={exportCsv} disabled={!data?.rows.length}>Export CSV</button>
          </div>

          <ErrorBox>{error}</ErrorBox>
          {loading ? <Loading /> : !data?.rows.length ? (
            <div className="card"><Empty title="No data for this period." /></div>
          ) : (
            <Table
              head={data.columns.map((c) => (
                <th key={c.key} className={`th ${c.type === 'money' || c.type === 'number' ? 'text-right' : ''}`}>{c.label}</th>
              ))}
              foot={Object.keys(data.totals).length > 0 && (
                <tr>
                  {data.columns.map((c, i) => (
                    <td key={c.key} className={`td ${c.type === 'money' || c.type === 'number' ? 'num text-right' : ''}`}>
                      {i === 0 ? 'Total' : data.totals[c.key] !== undefined ? cell(c, data.totals[c.key]) : ''}
                    </td>
                  ))}
                </tr>
              )}
            >
              {data.rows.map((r, idx) => (
                <tr key={idx}>
                  {data.columns.map((c) => {
                    const numeric = c.type === 'money' || c.type === 'number';
                    const negative = numeric && Number(r[c.key]) < 0;
                    return (
                      <td key={c.key} className={`td ${numeric ? 'num text-right' : ''} ${negative ? 'text-loss' : ''} ${c.key === 'profit' && !negative ? 'text-gain' : ''}`}>
                        {cell(c, r[c.key])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
