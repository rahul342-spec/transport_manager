import { useState } from 'react';
import { Link } from 'react-router-dom';
import MasterPage from '../components/MasterPage';
import { useApi } from '../lib/useApi';
import { date, money } from '../lib/format';
import { Badge, ErrorBox, Loading, Modal } from '../components/ui';

function ClientHistory({ client, onClose }) {
  const { data, loading, error } = useApi(client ? `/clients/${client._id}/history` : null, { skip: !client });
  const billed = (data?.work || []).reduce((s, w) => s + w.amount, 0);
  const received = (data?.payments || []).reduce((s, p) => s + p.amount, 0);
  const outstanding = (data?.work || []).reduce((s, w) => s + w.pendingAmount, 0);

  return (
    <Modal open={Boolean(client)} onClose={onClose} wide title={client?.name || ''}
      footer={<Link to={`/invoices?clientId=${client?._id}`} className="btn-primary">Create invoice</Link>}>
      <ErrorBox>{error}</ErrorBox>
      {loading || !data ? <Loading /> : (
        <>
          <div className="text-[15px] text-asphalt-500">
            {[data.client.contactPerson, data.client.phone, data.client.email].filter(Boolean).join(', ')}
            {data.client.gstNumber && <div>GSTIN {data.client.gstNumber}</div>}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-lane p-4">
            <div><div className="text-sm text-asphalt-500">Billed</div><div className="num text-xl font-semibold">{money(billed)}</div></div>
            <div><div className="text-sm text-asphalt-500">Received</div><div className="num text-xl font-semibold text-gain">{money(received)}</div></div>
            <div><div className="text-sm text-asphalt-500">Outstanding</div><div className={`num text-xl font-semibold ${outstanding ? 'text-loss' : ''}`}>{money(outstanding)}</div></div>
          </div>

          <h3 className="mt-5 font-display text-lg font-semibold">Work history</h3>
          {data.work.length === 0 ? <p className="mt-1 text-asphalt-500">No work yet.</p> : (
            <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-line">
              <table className="w-full text-[15px]">
                <tbody>
                  {data.work.map((w) => (
                    <tr key={w._id} className="border-t border-line first:border-t-0">
                      <td className="px-3 py-2 whitespace-nowrap">{date(w.date)}</td>
                      <td className="px-3 py-2">{w.location}<div className="text-[13px] text-asphalt-500">{w.vehicleId?.vehicleNumber}, {w.driverId?.name}</div></td>
                      <td className="num px-3 py-2 text-right">{money(w.amount)}</td>
                      <td className="px-3 py-2"><Badge>{w.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="mt-5 font-display text-lg font-semibold">Payments</h3>
          {data.payments.length === 0 ? <p className="mt-1 text-asphalt-500">No payments yet.</p> : (
            <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {data.payments.map((p) => (
                <li key={p._id} className="flex justify-between px-3 py-2 text-[15px]">
                  <span>{date(p.date)}, {p.method}</span>
                  <span className="num font-semibold">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

export default function Clients() {
  const { data: summary } = useApi('/clients/summary');
  const [viewing, setViewing] = useState(null);
  const s = (id) => summary?.[id] || {};

  return (
    <>
      <MasterPage
        title="Clients"
        subtitle="Tap a client to see their work, payments and balance."
        endpoint="/clients"
        noun="Client"
        searchPlaceholder="Search name, phone, contact"
        onRowClick={setViewing}
        fields={[
          { key: 'name', label: 'Client / company name', required: true, full: true },
          { key: 'contactPerson', label: 'Contact person' },
          { key: 'phone', label: 'Phone', type: 'tel' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'gstNumber', label: 'GSTIN', hint: 'Optional', upper: true },
          { key: 'address', label: 'Address', type: 'textarea', full: true },
        ]}
        columns={[
          { label: 'Client', render: (c) => <><span className="font-semibold">{c.name}</span>{c.contactPerson && <div className="text-[13px] text-asphalt-500">{c.contactPerson}</div>}</> },
          { label: 'Phone', render: (c) => c.phone || '–' },
          { label: 'Billed', className: 'text-right', render: (c) => <span className="num">{money(s(c._id).billed)}</span> },
          { label: 'Received', className: 'text-right', render: (c) => <span className="num">{money(s(c._id).received)}</span> },
          {
            label: 'Outstanding',
            className: 'text-right',
            render: (c) => <span className={`num font-semibold ${s(c._id).outstanding ? 'text-loss' : ''}`}>{money(s(c._id).outstanding)}</span>,
          },
        ]}
      />
      <ClientHistory client={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
