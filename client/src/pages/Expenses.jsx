import { useEffect, useState } from 'react';
import { api, qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useLookups, activeOr } from '../lib/useLookups';
import { date, isoDay, money, toInputDate } from '../lib/format';
import { defaultPeriod, periodParams } from '../lib/period';
import { Empty, ErrorBox, Field, Loading, Modal, PageHeader, PeriodPicker, Table, useToast } from '../components/ui';

const CATEGORIES = ['Diesel', 'Salary', 'Maintenance', 'Toll/Parking', 'Other'];
const EMPTY = { date: isoDay(), category: 'Diesel', amount: '', vehicleId: '', driverId: '', description: '', reference: '' };

function ExpenseForm({ open, onClose, onSaved, expense, lookups }) {
  const editing = Boolean(expense?._id);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(editing ? {
      ...EMPTY, ...expense, date: toInputDate(expense.date),
      vehicleId: expense.vehicleId?._id || '', driverId: expense.driverId?._id || '',
    } : EMPTY);
  }, [open, editing, expense]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Picking a driver for a salary pre-fills their monthly salary
  const pickDriver = (e) => {
    const d = lookups.drivers.find((x) => x._id === e.target.value);
    setForm((f) => ({
      ...f,
      driverId: e.target.value,
      amount: f.category === 'Salary' && d?.salary && !f.amount ? d.salary : f.amount,
      description: f.category === 'Salary' && d && !f.description ? `Salary, ${d.name}` : f.description,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...form, amount: Number(form.amount) };
      ['vehicleId', 'driverId'].forEach((k) => { if (!body[k]) body[k] = null; });
      await api(editing ? `/expenses/${expense._id}` : '/expenses', { method: editing ? 'PUT' : 'POST', body });
      onSaved(editing);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit expense' : 'Add expense'}
      footer={<>
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" form="expense-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save expense'}</button>
      </>}>
      <ErrorBox>{error}</ErrorBox>
      <form id="expense-form" onSubmit={submit} className="space-y-4">
        <div>
          <span className="label">Category</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={form.category === c}
                onClick={() => setForm((f) => ({ ...f, category: c }))}
                className={`rounded-md border px-3 py-1.5 text-[15px] font-medium ${form.category === c ? 'border-asphalt bg-asphalt text-white' : 'border-line bg-white hover:bg-lane'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)">
            <input className="input num text-lg" type="number" min="0" step="0.01" inputMode="decimal" required value={form.amount} onChange={set('amount')} />
          </Field>
          <Field label="Date"><input className="input" type="date" required value={form.date} onChange={set('date')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vehicle" hint="Optional">
            <select className="input" value={form.vehicleId} onChange={set('vehicleId')}>
              <option value="">None</option>
              {activeOr(lookups.vehicles, form.vehicleId).map((v) => <option key={v._id} value={v._id}>{v.vehicleNumber}</option>)}
            </select>
          </Field>
          <Field label="Driver" hint="Optional">
            <select className="input" value={form.driverId} onChange={pickDriver}>
              <option value="">None</option>
              {activeOr(lookups.drivers, form.driverId).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description"><input className="input" value={form.description} onChange={set('description')} placeholder="e.g. Diesel at HP pump" /></Field>
        <Field label="Payment reference" hint="Optional bill or UPI reference"><input className="input" value={form.reference} onChange={set('reference')} /></Field>
      </form>
    </Modal>
  );
}

export default function Expenses() {
  const toast = useToast();
  const lookups = useLookups();
  const [period, setPeriod] = useState(defaultPeriod);
  const [category, setCategory] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [form, setForm] = useState({ open: false, expense: null });
  const { data, loading, error, reload } = useApi(`/expenses${qs({ ...periodParams(period), category, vehicleId, limit: 500 })}`);

  const total = (data?.items || []).reduce((s, e) => s + e.amount, 0);
  const byCat = CATEGORIES.map((c) => ({ c, v: (data?.items || []).filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0) }));

  const remove = async (x) => {
    if (!window.confirm(`Delete ${x.category} expense of ${money(x.amount)}?`)) return;
    try {
      await api(`/expenses/${x._id}`, { method: 'DELETE' });
      toast('Expense deleted');
      reload();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Diesel, salaries and everything else the business spends."
        actions={<button type="button" className="btn-primary" onClick={() => setForm({ open: true, expense: null })}>Add expense</button>}
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <PeriodPicker value={period} onChange={setPeriod} />
        <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="input w-auto" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} aria-label="Vehicle">
          <option value="">All vehicles</option>
          {lookups.vehicles.map((v) => <option key={v._id} value={v._id}>{v.vehicleNumber}</option>)}
        </select>
      </div>

      {!category && data?.items.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {byCat.map(({ c, v }) => (
            <div key={c} className="card px-3 py-2.5">
              <div className="text-sm text-asphalt-500">{c}</div>
              <div className="num text-xl font-semibold">{money(v)}</div>
            </div>
          ))}
          <div className="card border-asphalt px-3 py-2.5">
            <div className="text-sm text-asphalt-500">Total</div>
            <div className="num text-xl font-semibold">{money(total)}</div>
          </div>
        </div>
      )}

      <ErrorBox>{error}</ErrorBox>
      {loading && !data ? <Loading /> : !data?.items.length ? (
        <div className="card"><Empty title="No expenses in this period." action={<button type="button" className="btn-primary" onClick={() => setForm({ open: true, expense: null })}>Add expense</button>} /></div>
      ) : (
        <Table
          head={<>
            <th className="th">Date</th><th className="th">Category</th><th className="th">Description</th>
            <th className="th">Vehicle / driver</th><th className="th text-right">Amount</th><th className="th" />
          </>}
          foot={<tr><td className="td" colSpan={4}>Total</td><td className="td num text-right">{money(total)}</td><td className="td" /></tr>}
        >
          {data.items.map((x) => (
            <tr key={x._id}>
              <td className="td whitespace-nowrap">{date(x.date)}</td>
              <td className="td">{x.category}</td>
              <td className="td">{x.description || '–'}{x.reference && <div className="text-[13px] text-asphalt-500">Ref {x.reference}</div>}</td>
              <td className="td">{[x.vehicleId?.vehicleNumber, x.driverId?.name].filter(Boolean).join(', ') || '–'}</td>
              <td className="td num text-right font-semibold">{money(x.amount)}</td>
              <td className="td whitespace-nowrap text-right text-sm font-semibold">
                <button type="button" className="underline" onClick={() => setForm({ open: true, expense: x })}>Edit</button>
                <button type="button" className="ml-3 text-loss underline" onClick={() => remove(x)}>Delete</button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <ExpenseForm
        open={form.open}
        expense={form.expense}
        lookups={lookups}
        onClose={() => setForm({ open: false, expense: null })}
        onSaved={(wasEdit) => { setForm({ open: false, expense: null }); toast(wasEdit ? 'Expense updated' : 'Expense saved'); reload(); }}
      />
    </>
  );
}
