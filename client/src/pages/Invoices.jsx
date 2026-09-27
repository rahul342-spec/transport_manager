import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, openFile, qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useLookups } from '../lib/useLookups';
import { useAuth } from '../context/AuthContext';
import { date, isoDay, money } from '../lib/format';
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Table, useToast } from '../components/ui';

function CreateInvoice({ open, onClose, onCreated, clients, initialClientId }) {
  const { business } = useAuth();
  const [clientId, setClientId] = useState('');
  const [jobs, setJobs] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [meta, setMeta] = useState({ date: isoDay(), dueDate: '', gstPercent: 0, notes: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientId(initialClientId || '');
    setMeta({ date: isoDay(), dueDate: '', gstPercent: business?.defaultGstPercent || 0, notes: '' });
    setError('');
  }, [open, initialClientId, business]);

  useEffect(() => {
    setPicked(new Set());
    if (!clientId) { setJobs([]); return; }
    api(`/work${qs({ clientId, invoiced: 'false', limit: 500 })}`)
      .then((r) => { setJobs(r.items); setPicked(new Set(r.items.map((j) => j._id))); })
      .catch((e) => setError(e.message));
  }, [clientId]);

  const toggle = (id) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const subtotal = jobs.filter((j) => picked.has(j._id)).reduce((s, j) => s + j.amount, 0);
  const gst = Math.round(subtotal * (Number(meta.gstPercent) || 0)) / 100;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const inv = await api('/invoices', {
        method: 'POST',
        body: { clientId, workEntryIds: [...picked], ...meta, dueDate: meta.dueDate || undefined },
      });
      onCreated(inv);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} wide title="Create invoice"
      footer={<>
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" disabled={busy || picked.size === 0} onClick={submit}>
          {busy ? 'Creating…' : `Create invoice for ${money(subtotal + gst)}`}
        </button>
      </>}>
      <ErrorBox>{error}</ErrorBox>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client" className="sm:col-span-2">
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select client</option>
            {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </Field>
      </div>

      {clientId && (
        jobs.length === 0 ? (
          <p className="mt-4 text-asphalt-500">All of this client's work is already invoiced.</p>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between">
              <span className="label mb-0">Work to include ({picked.size} of {jobs.length})</span>
              <button type="button" className="text-sm font-semibold underline"
                onClick={() => setPicked(picked.size === jobs.length ? new Set() : new Set(jobs.map((j) => j._id)))}>
                {picked.size === jobs.length ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {jobs.map((j) => (
                <li key={j._id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-lane">
                    <input type="checkbox" className="h-4 w-4 accent-asphalt" checked={picked.has(j._id)} onChange={() => toggle(j._id)} />
                    <span className="flex-1 text-[15px]">{date(j.date)}, {j.location}<span className="text-asphalt-500"> ({j.vehicleId?.vehicleNumber}, {j.hours} h)</span></span>
                    <span className="num">{money(j.amount)}</span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Invoice date"><input className="input" type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} /></Field>
              <Field label="Due date" hint={`Blank = ${business?.paymentTermsDays ?? 15} days after invoice`}>
                <input className="input" type="date" value={meta.dueDate} onChange={(e) => setMeta({ ...meta, dueDate: e.target.value })} />
              </Field>
              <Field label="GST %"><input className="input" type="number" min="0" max="28" step="0.01" value={meta.gstPercent} onChange={(e) => setMeta({ ...meta, gstPercent: e.target.value })} /></Field>
              <Field label="Notes on invoice" className="sm:col-span-3"><input className="input" value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} placeholder="Bank details, thank-you note…" /></Field>
            </div>

            <div className="mt-4 space-y-1 rounded-lg bg-lane p-4 text-[15px]">
              <div className="flex justify-between"><span>Subtotal</span><span className="num">{money(subtotal, true)}</span></div>
              {Number(meta.gstPercent) > 0 && <div className="flex justify-between"><span>GST ({meta.gstPercent}%)</span><span className="num">{money(gst, true)}</span></div>}
              <div className="flex justify-between border-t border-line pt-1 text-lg font-semibold"><span>Total</span><span className="num">{money(subtotal + gst, true)}</span></div>
            </div>
          </>
        )
      )}
    </Modal>
  );
}

export default function Invoices() {
  const toast = useToast();
  const { clients } = useLookups();
  const [params, setParams] = useSearchParams();
  const [clientId, setClientId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [initialClient, setInitialClient] = useState('');
  const { data, loading, error, reload } = useApi(`/invoices${qs({ clientId })}`);

  useEffect(() => {
    const c = params.get('clientId');
    if (c) {
      setInitialClient(c);
      setCreateOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const pdf = async (inv) => {
    try { await openFile(`/invoices/${inv._id}/pdf`); } catch (e) { toast(e.message, 'error'); }
  };

  const remove = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoiceNumber}? The work entries become un-invoiced again. Payments are kept.`)) return;
    try {
      await api(`/invoices/${inv._id}`, { method: 'DELETE' });
      toast('Invoice deleted');
      reload();
    } catch (e) { toast(e.message, 'error'); }
  };

  const today = new Date();
  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Bill one or more jobs for a client and download a PDF."
        actions={<button type="button" className="btn-primary" onClick={() => { setInitialClient(''); setCreateOpen(true); }}>Create invoice</button>}
      />
      <div className="mb-4">
        <select className="input w-auto" value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Client">
          <option value="">All clients</option>
          {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      <ErrorBox>{error}</ErrorBox>
      {loading && !data ? <Loading /> : !data?.items.length ? (
        <div className="card"><Empty title="No invoices yet." action={<button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>Create invoice</button>} /></div>
      ) : (
        <Table head={<>
          <th className="th">Invoice</th><th className="th">Date</th><th className="th">Client</th><th className="th">Due</th>
          <th className="th text-right">Total</th><th className="th text-right">Balance</th><th className="th">Status</th><th className="th" />
        </>}>
          {data.items.map((inv) => {
            const overdue = inv.balance > 0 && inv.dueDate && new Date(inv.dueDate) < today;
            return (
              <tr key={inv._id}>
                <td className="td font-semibold">{inv.invoiceNumber}</td>
                <td className="td whitespace-nowrap">{date(inv.date)}</td>
                <td className="td">{inv.clientId?.name}</td>
                <td className="td whitespace-nowrap">{date(inv.dueDate)}{overdue && <div><Badge tone="Overdue">Overdue</Badge></div>}</td>
                <td className="td num text-right">{money(inv.total)}</td>
                <td className={`td num text-right ${inv.balance ? 'text-loss' : ''}`}>{money(inv.balance)}</td>
                <td className="td"><Badge>{inv.status}</Badge></td>
                <td className="td whitespace-nowrap text-right text-sm font-semibold">
                  <button type="button" className="btn-dark px-3 py-1.5 text-sm" onClick={() => pdf(inv)}>PDF</button>
                  <button type="button" className="ml-3 text-loss underline" onClick={() => remove(inv)}>Delete</button>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <CreateInvoice
        open={createOpen}
        clients={clients}
        initialClientId={initialClient}
        onClose={() => setCreateOpen(false)}
        onCreated={(inv) => { setCreateOpen(false); toast(`Invoice ${inv.invoiceNumber} created`); reload(); }}
      />
    </>
  );
}
