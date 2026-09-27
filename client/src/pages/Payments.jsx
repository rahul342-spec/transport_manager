import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useLookups } from '../lib/useLookups';
import { date, money } from '../lib/format';
import { defaultPeriod, periodParams } from '../lib/period';
import { Badge, Empty, ErrorBox, Loading, PageHeader, PeriodPicker, Table, useToast } from '../components/ui';
import PaymentForm from './PaymentForm';

const REMINDERS = ['None', 'Reminded', 'Promised', 'Disputed'];

function PendingTab({ clients, onPay, refreshKey }) {
  const toast = useToast();
  const [clientId, setClientId] = useState('');
  const { data, loading, error, reload } = useApi(`/payments/pending${qs({ clientId, _: refreshKey })}`);

  const byClient = useMemo(() => {
    const m = {};
    (data || []).forEach((w) => {
      const k = w.clientId?._id;
      m[k] ||= { name: w.clientId?.name, total: 0 };
      m[k].total += w.pendingAmount;
    });
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [data]);

  const setReminder = async (w, reminderStatus) => {
    try {
      await api(`/work/${w._id}`, { method: 'PUT', body: { reminderStatus } });
      reload();
    } catch (e) { toast(e.message, 'error'); }
  };

  const total = (data || []).reduce((s, w) => s + w.pendingAmount, 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="input w-auto" value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Client">
          <option value="">All clients</option>
          {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <span className="text-asphalt-500">Total outstanding <span className="num ml-1 text-xl font-semibold text-loss">{money(total)}</span></span>
      </div>

      {!clientId && byClient.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {byClient.slice(0, 6).map((c) => (
            <span key={c.name} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm">
              {c.name} <span className="num ml-1 font-semibold text-loss">{money(c.total)}</span>
            </span>
          ))}
        </div>
      )}

      <ErrorBox>{error}</ErrorBox>
      {loading && !data ? <Loading /> : !data?.length ? (
        <div className="card"><Empty title="No pending payments." /></div>
      ) : (
        <Table head={<>
          <th className="th">Client</th><th className="th">Work date</th><th className="th">Location</th>
          <th className="th">Invoice</th><th className="th">Due</th><th className="th text-right">Pending</th>
          <th className="th">Reminder</th><th className="th" />
        </>}>
          {data.map((w) => (
            <tr key={w._id}>
              <td className="td font-medium">
                {w.clientId?.name}
                {w.clientId?.phone && <div className="text-[13px]"><a className="underline" href={`tel:${w.clientId.phone}`}>{w.clientId.phone}</a></div>}
              </td>
              <td className="td whitespace-nowrap">{date(w.date)}<div className="text-[13px] text-asphalt-500">{w.daysOld} days ago</div></td>
              <td className="td">{w.location}</td>
              <td className="td">{w.invoiceId?.invoiceNumber || '–'}</td>
              <td className="td whitespace-nowrap">{w.effectiveDueDate ? date(w.effectiveDueDate) : '–'}{w.overdue && <div><Badge tone="Overdue">Overdue</Badge></div>}</td>
              <td className="td num text-right font-semibold text-loss">{money(w.pendingAmount)}</td>
              <td className="td">
                <select className="input py-1 text-sm" value={w.reminderStatus} onChange={(e) => setReminder(w, e.target.value)} aria-label="Reminder status">
                  {REMINDERS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </td>
              <td className="td text-right">
                <button type="button" className="btn-dark whitespace-nowrap px-3 py-1.5 text-sm"
                  onClick={() => onPay({ clientId: w.clientId?._id, workEntryId: w._id, amount: w.pendingAmount })}>
                  Record payment
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

function ReceivedTab({ clients, onEdit, refreshKey }) {
  const toast = useToast();
  const [period, setPeriod] = useState(defaultPeriod);
  const [clientId, setClientId] = useState('');
  const [method, setMethod] = useState('');
  const { data, loading, error, reload } = useApi(`/payments${qs({ ...periodParams(period), clientId, method, limit: 500, _: refreshKey })}`);

  const remove = async (p) => {
    if (!window.confirm(`Delete payment of ${money(p.amount)} from ${p.clientId?.name}?`)) return;
    try {
      await api(`/payments/${p._id}`, { method: 'DELETE' });
      toast('Payment deleted');
      reload();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <PeriodPicker value={period} onChange={setPeriod} />
        <select className="input w-auto" value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Client">
          <option value="">All clients</option>
          {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select className="input w-auto" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method">
          <option value="">Any method</option>
          {['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'].map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {loading && !data ? <Loading /> : !data?.items.length ? (
        <div className="card"><Empty title="No payments received in this period." /></div>
      ) : (
        <Table
          head={<>
            <th className="th">Date</th><th className="th">Client</th><th className="th">For job</th>
            <th className="th">Method</th><th className="th">Reference</th><th className="th text-right">Amount</th><th className="th" />
          </>}
          foot={<tr><td className="td" colSpan={5}>Total received</td><td className="td num text-right text-gain">{money(data.totals.amount)}</td><td className="td" /></tr>}
        >
          {data.items.map((p) => (
            <tr key={p._id}>
              <td className="td whitespace-nowrap">{date(p.date)}</td>
              <td className="td font-medium">{p.clientId?.name}</td>
              <td className="td">{p.workEntryId ? `${date(p.workEntryId.date)}, ${p.workEntryId.location}` : <span className="text-asphalt-500">Advance</span>}</td>
              <td className="td">{p.method}</td>
              <td className="td">{p.reference || '–'}</td>
              <td className="td num text-right font-semibold">{money(p.amount)}</td>
              <td className="td whitespace-nowrap text-right text-sm font-semibold">
                <button type="button" className="underline" onClick={() => onEdit(p)}>Edit</button>
                <button type="button" className="ml-3 text-loss underline" onClick={() => remove(p)}>Delete</button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

export default function Payments() {
  const toast = useToast();
  const { clients } = useLookups();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'pending' ? 'pending' : 'received';
  const [form, setForm] = useState({ open: false, preset: null, payment: null });
  const [refreshKey, setRefreshKey] = useState(0);

  const tabBtn = (key, label) => (
    <button
      type="button"
      onClick={() => setParams(key === 'pending' ? { tab: 'pending' } : {})}
      className={`border-b-[3px] px-1 pb-2 text-[15px] font-semibold ${tab === key ? 'border-sign text-asphalt' : 'border-transparent text-asphalt-500 hover:text-asphalt'}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Money received from clients, and what's still owed."
        actions={<button type="button" className="btn-primary" onClick={() => setForm({ open: true, preset: null, payment: null })}>Record payment</button>}
      />
      <div className="mb-5 flex gap-6 border-b border-line">
        {tabBtn('received', 'Received')}
        {tabBtn('pending', 'Pending & reminders')}
      </div>

      {tab === 'pending'
        ? <PendingTab clients={clients} refreshKey={refreshKey} onPay={(preset) => setForm({ open: true, preset, payment: null })} />
        : <ReceivedTab clients={clients} refreshKey={refreshKey} onEdit={(payment) => setForm({ open: true, preset: null, payment })} />}

      <PaymentForm
        open={form.open}
        clients={clients}
        preset={form.preset}
        payment={form.payment}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={() => { setForm((f) => ({ ...f, open: false })); toast('Payment saved'); setRefreshKey((k) => k + 1); }}
      />
    </>
  );
}
