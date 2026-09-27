import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ErrorBox, Field, PageHeader, useToast } from '../components/ui';

export default function Settings() {
  const toast = useToast();
  const { business, setBusiness } = useAuth();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (business) setForm({ ...business });
  }, [business]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = await api('/business', {
        method: 'PUT',
        body: {
          ...form,
          defaultGstPercent: Number(form.defaultGstPercent) || 0,
          paymentTermsDays: Number(form.paymentTermsDays) || 0,
        },
      });
      setBusiness(updated);
      toast('Settings saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    try {
      await api('/auth/change-password', { method: 'POST', body: pw });
      setPw({ currentPassword: '', newPassword: '' });
      toast('Password changed');
    } catch (err) {
      setPwError(err.message);
    }
  };

  if (!form) return null;
  return (
    <>
      <PageHeader title="Business settings" subtitle="These details print on your invoices." />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <form onSubmit={save} className="card grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><ErrorBox>{error}</ErrorBox></div>
          <Field label="Business name" className="sm:col-span-2"><input className="input" required value={form.name || ''} onChange={set('name')} /></Field>
          <Field label="Phone"><input className="input" value={form.phone || ''} onChange={set('phone')} /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email || ''} onChange={set('email')} /></Field>
          <Field label="Address" className="sm:col-span-2"><textarea className="input" rows={2} value={form.address || ''} onChange={set('address')} /></Field>
          <Field label="GSTIN" hint="Optional"><input className="input uppercase" value={form.gstNumber || ''} onChange={set('gstNumber')} /></Field>
          <Field label="Default GST %" hint="Used for new invoices, 0 if not registered">
            <input className="input" type="number" min="0" max="28" step="0.01" value={form.defaultGstPercent ?? 0} onChange={set('defaultGstPercent')} />
          </Field>
          <Field label="Invoice prefix" hint={`Next invoice: ${form.invoicePrefix || 'INV'}-${String((form.invoiceSeq || 0) + 1).padStart(4, '0')}`}>
            <input className="input uppercase" value={form.invoicePrefix || ''} onChange={set('invoicePrefix')} />
          </Field>
          <Field label="Payment terms (days)" hint="Default due date after invoice">
            <input className="input" type="number" min="0" value={form.paymentTermsDays ?? 15} onChange={set('paymentTermsDays')} />
          </Field>
          <div className="sm:col-span-2"><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>
        </form>

        <form onSubmit={changePassword} className="card h-fit space-y-4 p-5">
          <h2 className="font-display text-lg font-semibold">Change password</h2>
          <ErrorBox>{pwError}</ErrorBox>
          <Field label="Current password"><input className="input" type="password" autoComplete="current-password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <Field label="New password" hint="At least 8 characters"><input className="input" type="password" autoComplete="new-password" minLength={8} required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
          <button className="btn-dark">Update password</button>
        </form>
      </div>
    </>
  );
}
