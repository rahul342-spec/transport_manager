import { useEffect, useState } from 'react';
import { api, qs } from '../lib/api';
import { useApi } from '../lib/useApi';
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Table, useToast } from './ui';

/**
 * Generic list + add/edit page for simple records (vehicles, drivers, clients).
 * fields:  [{ key, label, type?, required?, hint?, full? }]
 * columns: [{ label, render(row), className? }]
 */
export default function MasterPage({
  title, subtitle, endpoint, noun, fields, columns, searchPlaceholder, extraActions, onRowClick, refreshKey,
}) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [active, setActive] = useState('true');
  const [form, setForm] = useState(null); // null = closed; {} = new; {...row} = edit
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, loading, error: loadError, reload } = useApi(`${endpoint}${qs({ q, active, limit: 500, _: refreshKey })}`);

  const editing = Boolean(form?._id);
  useEffect(() => { setError(''); }, [form]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {};
      fields.forEach((f) => {
        let v = form[f.key];
        if (f.type === 'number') v = v === '' || v === undefined || v === null ? null : Number(v);
        if (f.type === 'checkbox') v = Boolean(v);
        body[f.key] = v;
      });
      await api(editing ? `${endpoint}/${form._id}` : endpoint, { method: editing ? 'PUT' : 'POST', body });
      toast(`${noun} ${editing ? 'updated' : 'added'}`);
      setForm(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      await api(`${endpoint}/${row._id}`, { method: 'PUT', body: { active: !row.active } });
      toast(row.active ? `${noun} marked inactive` : `${noun} reactivated`);
      reload();
    } catch (e) { toast(e.message, 'error'); }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete this ${noun.toLowerCase()}?`)) return;
    try {
      await api(`${endpoint}/${row._id}`, { method: 'DELETE' });
      toast(`${noun} deleted`);
      reload();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={<>{extraActions}<button type="button" className="btn-primary" onClick={() => setForm({ active: true })}>Add {noun.toLowerCase()}</button></>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="input w-64" placeholder={searchPlaceholder || 'Search'} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input w-auto" value={active} onChange={(e) => setActive(e.target.value)} aria-label="Status">
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="">All</option>
        </select>
      </div>

      <ErrorBox>{loadError}</ErrorBox>
      {loading && !data ? <Loading /> : !data?.items.length ? (
        <div className="card"><Empty title={q ? 'Nothing matches that search.' : `No ${title.toLowerCase()} yet.`}
          action={!q && <button type="button" className="btn-primary" onClick={() => setForm({ active: true })}>Add {noun.toLowerCase()}</button>} /></div>
      ) : (
        <Table head={<>
          {columns.map((c) => <th key={c.label} className={`th ${c.className || ''}`}>{c.label}</th>)}
          <th className="th">Status</th><th className="th" />
        </>}>
          {data.items.map((row) => (
            <tr key={row._id} className={onRowClick ? 'cursor-pointer hover:bg-lane/60' : ''} onClick={() => onRowClick?.(row)}>
              {columns.map((c) => <td key={c.label} className={`td ${c.className || ''}`}>{c.render(row)}</td>)}
              <td className="td"><Badge>{row.active ? 'Active' : 'Inactive'}</Badge></td>
              <td className="td whitespace-nowrap text-right text-sm font-semibold" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="underline" onClick={() => setForm({ ...row })}>Edit</button>
                <button type="button" className="ml-3 underline" onClick={() => toggleActive(row)}>{row.active ? 'Deactivate' : 'Activate'}</button>
                <button type="button" className="ml-3 text-loss underline" onClick={() => remove(row)}>Delete</button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={editing ? `Edit ${noun.toLowerCase()}` : `Add ${noun.toLowerCase()}`}
        footer={<>
          <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
          <button type="submit" form="master-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </>}
      >
        <ErrorBox>{error}</ErrorBox>
        {form && (
          <form id="master-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              f.type === 'checkbox' ? null : (
                <Field key={f.key} label={f.label} hint={f.hint} className={f.full ? 'sm:col-span-2' : ''}>
                  {f.type === 'textarea' ? (
                    <textarea className="input" rows={2} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  ) : (
                    <input
                      className={`input ${f.upper ? 'uppercase' : ''}`}
                      type={f.type || 'text'}
                      required={f.required}
                      min={f.type === 'number' ? 0 : undefined}
                      value={form[f.key] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  )}
                </Field>
              )
            ))}
          </form>
        )}
      </Modal>
    </>
  );
}
