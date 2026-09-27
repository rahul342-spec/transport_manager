import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { hoursBetween, isoDay, money, toInputDate } from '../lib/format';
import { activeOr } from '../lib/useLookups';
import { Badge, ErrorBox, Field, Modal } from '../components/ui';

const EMPTY = {
  date: isoDay(), clientId: '', location: '', pickup: '', destination: '', vehicleId: '', driverId: '',
  startTime: '09:00', endTime: '17:00', amount: '', received: '', paymentMethod: 'Cash', dueDate: '', notes: '',
};

function statusFor(amount, received) {
  const a = Number(amount) || 0;
  const r = Number(received) || 0;
  if (a - r <= 0) return 'Paid';
  return r > 0 ? 'Partial' : 'Pending';
}

export default function WorkForm({ open, onClose, onSaved, entry, lookups }) {
  const editing = Boolean(entry?._id);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showRoute, setShowRoute] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setForm({
        ...EMPTY,
        ...entry,
        date: toInputDate(entry.date),
        dueDate: toInputDate(entry.dueDate),
        clientId: entry.clientId?._id || entry.clientId,
        vehicleId: entry.vehicleId?._id || entry.vehicleId,
        driverId: entry.driverId?._id || entry.driverId,
      });
      setShowRoute(Boolean(entry.pickup || entry.destination));
    } else {
      setForm(EMPTY);
      setShowRoute(false);
    }
  }, [open, entry, editing]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const hours = hoursBetween(form.startTime, form.endTime);
  const received = editing ? entry.received : Number(form.received) || 0;
  const pending = Math.max((Number(form.amount) || 0) - received, 0);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...form, amount: Number(form.amount) };
      if (!body.dueDate) delete body.dueDate;
      if (editing) {
        delete body.received;
        delete body.paymentMethod;
      } else {
        body.received = Number(form.received) || 0;
      }
      const saved = await api(editing ? `/work/${entry._id}` : '/work', { method: editing ? 'PUT' : 'POST', body });
      onSaved(saved, editing);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const noMasters = lookups.loaded && (!lookups.clients.length || !lookups.vehicles.length || !lookups.drivers.length);

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={editing ? 'Edit work entry' : 'Add daily work'}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="work-form" className="btn-primary" disabled={busy || noMasters}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Save work'}
          </button>
        </>
      }
    >
      {noMasters && (
        <ErrorBox>Add at least one client, vehicle and driver before recording work.</ErrorBox>
      )}
      <ErrorBox>{error}</ErrorBox>
      <form id="work-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Client">
          <select className="input" required value={form.clientId} onChange={set('clientId')}>
            <option value="">Select client</option>
            {activeOr(lookups.clients, form.clientId).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input className="input" type="date" required value={form.date} onChange={set('date')} />
        </Field>

        <Field label="Vehicle">
          <select className="input" required value={form.vehicleId} onChange={set('vehicleId')}>
            <option value="">Select vehicle</option>
            {activeOr(lookups.vehicles, form.vehicleId).map((v) => (
              <option key={v._id} value={v._id}>{v.vehicleNumber}{v.type ? ` (${v.type})` : ''}</option>
            ))}
          </select>
        </Field>
        <Field label="Driver">
          <select className="input" required value={form.driverId} onChange={set('driverId')}>
            <option value="">Select driver</option>
            {activeOr(lookups.drivers, form.driverId).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </Field>

        <Field label="Location" className="sm:col-span-2">
          <input className="input" required value={form.location} onChange={set('location')} placeholder="Site or area" />
        </Field>
        {showRoute ? (
          <>
            <Field label="Pickup"><input className="input" value={form.pickup} onChange={set('pickup')} /></Field>
            <Field label="Destination"><input className="input" value={form.destination} onChange={set('destination')} /></Field>
          </>
        ) : (
          <button type="button" className="-mt-2 justify-self-start text-sm font-semibold underline sm:col-span-2" onClick={() => setShowRoute(true)}>
            Add pickup and destination
          </button>
        )}

        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Field label="Start time"><input className="input" type="time" required value={form.startTime} onChange={set('startTime')} /></Field>
          <Field label="End time"><input className="input" type="time" required value={form.endTime} onChange={set('endTime')} /></Field>
          <Field label="Total hours">
            <div className="input num bg-lane text-lg">{hours}</div>
          </Field>
        </div>

        <Field label="Job amount (₹)">
          <input className="input num text-lg" type="number" min="0" step="0.01" inputMode="decimal" required value={form.amount} onChange={set('amount')} />
        </Field>
        {editing ? (
          <Field label="Payment received" hint="Record more payments from the work entry's detail view">
            <div className="input num bg-lane text-lg">{money(entry.received)}</div>
          </Field>
        ) : (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Payment received (₹)">
              <input className="input num text-lg" type="number" min="0" step="0.01" inputMode="decimal" value={form.received} onChange={set('received')} placeholder="0" />
            </Field>
            <Field label="Method">
              <select className="input" value={form.paymentMethod} onChange={set('paymentMethod')} disabled={!Number(form.received)}>
                {['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'].map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
          </div>
        )}

        <div className="flex items-center justify-between rounded-md bg-lane px-4 py-3 sm:col-span-2">
          <span className="text-asphalt-500">Pending amount</span>
          <span className="flex items-center gap-3">
            <span className={`num text-xl font-semibold ${pending > 0 ? 'text-loss' : 'text-gain'}`}>{money(pending)}</span>
            <Badge>{statusFor(form.amount, received)}</Badge>
          </span>
        </div>

        <Field label="Payment due date" hint="Optional. Shows the job as overdue after this date.">
          <input className="input" type="date" value={form.dueDate} onChange={set('dueDate')} />
        </Field>
        <Field label="Notes">
          <input className="input" value={form.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  );
}
