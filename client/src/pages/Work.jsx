import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useLookups } from '../lib/useLookups';
import { date, money, toInputDate } from '../lib/format';
import { defaultPeriod, periodParams } from '../lib/period';
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, PeriodPicker, Table, useToast } from '../components/ui';
import WorkForm from './WorkForm';
import PaymentForm from './PaymentForm';

const REMINDERS = ['None', 'Reminded', 'Promised', 'Disputed'];

function WorkDetail({ id, onClose, onChanged, onEdit }) {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(id ? `/work/${id}` : null, { skip: !id });
  const [payOpen, setPayOpen] = useState(false);
  const [editPayment, setEditPayment] = useState(null);

  const updateReminder = async (patch) => {
    try {
      await api(`/work/${id}`, { method: 'PUT', body: patch });
      reload();
      onChanged();
    } catch (e) { toast(e.message, 'error'); }
  };

  const removePayment = async (p) => {
    if (!window.confirm(`Delete payment of ${money(p.amount)}?`)) return;
    try {
      await api(`/payments/${p._id}`, { method: 'DELETE' });
      toast('Payment deleted');
      reload();
      onChanged();
    } catch (e) { toast(e.message, 'error'); }
  };

  const preset = useMemo(
    () => (data ? { clientId: data.clientId?._id, workEntryId: data._id, amount: data.pendingAmount } : null),
    [data]
  );

  return (
    <Modal open={Boolean(id)} onClose={onClose} wide title="Work details"
      footer={data && <button type="button" className="btn-ghost" onClick={() => onEdit(data)}>Edit entry</button>}>
      <ErrorBox>{error}</ErrorBox>
      {loading || !data ? <Loading /> : (
        <>
          <div className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
            <div><span className="text-asphalt-500">Client: </span>{data.clientId?.name}</div>
            <div><span className="text-asphalt-500">Date: </span>{date(data.date)}</div>
            <div><span className="text-asphalt-500">Location: </span>{data.location}{data.pickup ? ` (${data.pickup} to ${data.destination})` : ''}</div>
            <div><span className="text-asphalt-500">Time: </span>{data.startTime}–{data.endTime} ({data.hours} h)</div>
            <div><span className="text-asphalt-500">Vehicle: </span>{data.vehicleId?.vehicleNumber}</div>
            <div><span className="text-asphalt-500">Driver: </span>{data.driverId?.name}</div>
            {data.invoiceId && <div><span className="text-asphalt-500">Invoice: </span>{data.invoiceId.invoiceNumber}</div>}
            {data.notes && <div className="sm:col-span-2"><span className="text-asphalt-500">Notes: </span>{data.notes}</div>}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 rounded-lg bg-lane p-4">
            <div><div className="text-sm text-asphalt-500">Amount</div><div className="num text-xl font-semibold">{money(data.amount)}</div></div>
            <div><div className="text-sm text-asphalt-500">Received</div><div className="num text-xl font-semibold text-gain">{money(data.received)}</div></div>
            <div><div className="text-sm text-asphalt-500">Pending</div><div className={`num text-xl font-semibold ${data.pendingAmount ? 'text-loss' : ''}`}>{money(data.pendingAmount)}</div></div>
          </div>

          {data.pendingAmount > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Reminder status">
                <select className="input" value={data.reminderStatus} onChange={(e) => updateReminder({ reminderStatus: e.target.value })}>
                  {REMINDERS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Due date">
                <input className="input" type="date" value={toInputDate(data.dueDate)} onChange={(e) => updateReminder({ dueDate: e.target.value || null })} />
              </Field>
              <div className="flex items-end">
                <button type="button" className="btn-primary w-full" onClick={() => { setEditPayment(null); setPayOpen(true); }}>Record payment</button>
              </div>
            </div>
          )}

          <h3 className="mt-6 font-display text-lg font-semibold">Payments</h3>
          {data.payments.length === 0 ? (
            <p className="mt-2 text-asphalt-500">No payments yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
              {data.payments.map((p) => (
                <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <div>
                    <span className="num text-lg font-semibold">{money(p.amount)}</span>
                    <span className="ml-3 text-asphalt-500">{date(p.date)}, {p.method}{p.reference ? `, ${p.reference}` : ''}</span>
                  </div>
                  <div className="flex gap-3 text-sm font-semibold">
                    <button type="button" className="underline" onClick={() => { setEditPayment(p); setPayOpen(true); }}>Edit</button>
                    <button type="button" className="text-loss underline" onClick={() => removePayment(p)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <PaymentForm
            open={payOpen}
            onClose={() => setPayOpen(false)}
            preset={preset}
            payment={editPayment}
            onSaved={() => { setPayOpen(false); toast('Payment saved'); reload(); onChanged(); }}
          />
        </>
      )}
    </Modal>
  );
}

export default function Work() {
  const toast = useToast();
  const lookups = useLookups();
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState(defaultPeriod);
  const [filters, setFilters] = useState({ clientId: '', vehicleId: '', driverId: '', status: '', q: '' });
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const path = `/work${qs({ ...periodParams(period), ...filters, page, limit: 50 })}`;
  const { data, loading, error, reload } = useApi(path);

  useEffect(() => { setPage(1); }, [period, filters]);
  useEffect(() => {
    if (params.get('new')) {
      setEditing(null);
      setFormOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const remove = async (w) => {
    if (!window.confirm(`Delete work for ${w.clientId?.name} on ${date(w.date)}? Its payments will also be deleted.`)) return;
    try {
      await api(`/work/${w._id}`, { method: 'DELETE' });
      toast('Work entry deleted');
      reload();
    } catch (e) { toast(e.message, 'error'); }
  };

  const t = data?.totals || {};

  return (
    <>
      <PageHeader
        title="Daily work"
        subtitle="Every job or trip, with what was charged and collected."
        actions={<button type="button" className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>Add daily work</button>}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <PeriodPicker value={period} onChange={setPeriod} />
        <select className="input w-auto" value={filters.clientId} onChange={setF('clientId')} aria-label="Client">
          <option value="">All clients</option>
          {lookups.clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select className="input w-auto" value={filters.vehicleId} onChange={setF('vehicleId')} aria-label="Vehicle">
          <option value="">All vehicles</option>
          {lookups.vehicles.map((v) => <option key={v._id} value={v._id}>{v.vehicleNumber}</option>)}
        </select>
        <select className="input w-auto" value={filters.driverId} onChange={setF('driverId')} aria-label="Driver">
          <option value="">All drivers</option>
          {lookups.drivers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <select className="input w-auto" value={filters.status} onChange={setF('status')} aria-label="Payment status">
          <option value="">Any status</option>
          <option>Paid</option><option>Partial</option><option>Pending</option>
        </select>
        <input className="input w-44" placeholder="Search location" value={filters.q} onChange={setF('q')} aria-label="Search" />
      </div>

      <ErrorBox>{error}</ErrorBox>
      {loading && !data ? <Loading /> : data?.items.length === 0 ? (
        <div className="card"><Empty title="No work recorded for this period." action={<button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>Add daily work</button>} /></div>
      ) : data && (
        <>
          <Table
            head={<>
              <th className="th">Date</th><th className="th">Client</th><th className="th">Location</th>
              <th className="th">Vehicle / driver</th><th className="th text-right">Hours</th>
              <th className="th text-right">Amount</th><th className="th text-right">Pending</th>
              <th className="th">Status</th><th className="th" />
            </>}
            foot={<tr>
              <td className="td" colSpan={4}>Total ({data.total} jobs)</td>
              <td className="td num text-right">{Math.round((t.hours || 0) * 100) / 100}</td>
              <td className="td num text-right">{money(t.amount)}</td>
              <td className="td num text-right text-loss">{money(t.pending)}</td>
              <td className="td" colSpan={2} />
            </tr>}
          >
            {data.items.map((w) => (
              <tr key={w._id} className="cursor-pointer hover:bg-lane/60" onClick={() => setDetailId(w._id)}>
                <td className="td whitespace-nowrap">{date(w.date)}</td>
                <td className="td font-medium">{w.clientId?.name}</td>
                <td className="td">{w.location}</td>
                <td className="td whitespace-nowrap">{w.vehicleId?.vehicleNumber}<div className="text-[13px] text-asphalt-500">{w.driverId?.name}</div></td>
                <td className="td num text-right">{w.hours}</td>
                <td className="td num text-right">{money(w.amount)}</td>
                <td className={`td num text-right ${w.pendingAmount ? 'text-loss' : ''}`}>{money(w.pendingAmount)}</td>
                <td className="td"><Badge>{w.status}</Badge></td>
                <td className="td whitespace-nowrap text-right text-sm font-semibold" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="underline" onClick={() => { setEditing(w); setFormOpen(true); }}>Edit</button>
                  <button type="button" className="ml-3 text-loss underline" onClick={() => remove(w)}>Delete</button>
                </td>
              </tr>
            ))}
          </Table>
          {data.pages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span className="text-sm text-asphalt-500">Page {page} of {data.pages}</span>
              <button type="button" className="btn-ghost" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      <WorkForm
        open={formOpen}
        entry={editing}
        lookups={lookups}
        onClose={() => setFormOpen(false)}
        onSaved={(_, wasEdit) => { setFormOpen(false); toast(wasEdit ? 'Work entry updated' : 'Work saved'); reload(); }}
      />
      <WorkDetail
        id={detailId}
        onClose={() => setDetailId(null)}
        onChanged={reload}
        onEdit={(w) => { setDetailId(null); setEditing(w); setFormOpen(true); }}
      />
    </>
  );
}
