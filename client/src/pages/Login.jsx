import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ErrorBox, Field } from '../components/ui';
import AuthShell from './AuthShell';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Log in"
      subtitle="Welcome back."
      footer={<>New business? <Link to="/register" className="font-semibold text-asphalt underline">Create an account</Link></>}
    >
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password">
          <input className="input" type="password" autoComplete="current-password" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </AuthShell>
  );
}
