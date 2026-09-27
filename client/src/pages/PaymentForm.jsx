import { useEffect, useState } from 'react';
import { api, qs } from '../lib/api';
import { date, isoDay, money, toInputDate } from '../lib/format';
import { ErrorBox, Field, Modal } from '../components/ui';

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

/**
 * Record or edit a payment.
 * preset: { clientId, workEntryId } to lock the payment to a job (from the work detail view)
 * payment: existing payment to edit
 */
export default function PaymentForm({ open, onClose, onSaved, clients = [], preset, payment }) {
  const editing = Boolean(payment?._id);
  const [form, setForm] = useState({});
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setForm({
        amount: payment.amount, date: toInputDate(payment.date), method: payment.method,
        reference: payment.reference || '', notes: payment.notes || '',
      });
    } else {
      setForm({
        clientId: preset?.clientId || '', workEntryId: preset?.workEntryId || '',
        amount: preset?.amount ?? '', date: isoDay(), method: 'Cash', reference: '', notes: '',
      });
    }
  }, [open, editing, payment, preset]);

  // Load this client's unpaid jobs to link the payment
  useEffect(() => {
    if (!open || editing || preset?.workEntryId || !form.clientId) { setJobs([]); return; }
    api(`/work${qs({ clientId: form.clientId, pendingOnly: 'true', limit: 200 })}`)
      .then((r) => setJobs(r.items))
      .catch(() => setJobs([]));
  }, [open, editing, preset, form.clientId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pickJob = (e) => {
    const job = jobs.find((j) => j._id === e.target.value);
    setForm((f) => ({ ...f, workEntryId: e.target.value, amount: job ? job.pendingAmount : f.amount }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...form, amount: Number(form.amount) };
      const saved = await api(editing ? `/payments/${payment._id}` : '/payments', { method: editing ? 'PUT' : 'POST', body });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selectedJob = jobs.find((j) => j._id === form.workEntryId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit payment' : 'Record payment'}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="payment-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save payment'}</button>
        </>
      }
    >
      <ErrorBox>{error}</ErrorBox>
      <form id="payment-form" onSubmit={submit} className="space-y-4">
        {!editing && !preset?.workEntryId && (
          <>
            <Field label="Client">
              <select className="input" required value={form.clientId || ''} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value, workEntryId: '' }))}>
                <option value="">Select client</option>
                {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </Field>
            {form.clientId && (
              <Field
                label="For which job"
                hint={jobs.length ? 'Linking to a job updates its pending amount.' : 'This client has no unpaid jobs.'}
              >
                <select className="input" value={form.workEntryId || ''} onChange={pickJob}>
                  <option value="">Not linked to a job (advance)</option>
                  {jobs.map((j) => (
                    <option key={j._id} value={j._id}>
                      {date(j.date)}, {j.location}, {money(j.pendingAmount)} pending
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" hint={selectedJob ? `Up to ${money(selectedJob.pendingAmount)}` : preset?.amount ? `Up to ${money(preset.amount)}` : undefined}>
            <input className="input num text-lg" type="number" min="0.01" step="0.01" inputMode="decimal" required value={form.amount ?? ''} onChange={set('amount')} />
          </Field>
          <Field label="Date">
            <input className="input" type="date" required value={form.date || ''} onChange={set('date')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Method">
            <select className="input" value={form.method || 'Cash'} onChange={set('method')}>
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Reference" hint="UPI ID, cheque no.">
            <input className="input" value={form.reference || ''} onChange={set('reference')} />
          </Field>
        </div>
        <Field label="Notes"><input className="input" value={form.notes || ''} onChange={set('notes')} /></Field>
      </form>
    </Modal>
  );
}
