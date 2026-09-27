import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ErrorBox, Field } from '../components/ui';
import AuthShell from './AuthShell';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ businessName: '', name: '', phone: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Set up your business"
      subtitle="Takes a minute. You can add GST and invoice details later."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-asphalt underline">Log in</Link></>}
    >
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Business name"><input className="input" required value={form.businessName} onChange={set('businessName')} /></Field>
        <Field label="Your name"><input className="input" required value={form.name} onChange={set('name')} /></Field>
        <Field label="Phone"><input className="input" type="tel" value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={form.email} onChange={set('email')} /></Field>
        <Field label="Password" hint="At least 8 characters">
          <input className="input" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={set('password')} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
