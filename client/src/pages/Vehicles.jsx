import MasterPage from '../components/MasterPage';

export default function Vehicles() {
  return (
    <MasterPage
      title="Vehicles"
      subtitle="Trucks, tippers, JCBs and anything else you send out on jobs."
      endpoint="/vehicles"
      noun="Vehicle"
      searchPlaceholder="Search number or type"
      fields={[
        { key: 'vehicleNumber', label: 'Vehicle number', required: true, upper: true },
        { key: 'type', label: 'Type', hint: 'Truck, Tipper, JCB…' },
        { key: 'model', label: 'Model' },
        { key: 'notes', label: 'Notes', type: 'textarea', full: true },
      ]}
      columns={[
        { label: 'Vehicle number', render: (v) => <span className="font-semibold">{v.vehicleNumber}</span> },
        { label: 'Type', render: (v) => v.type || '–' },
        { label: 'Model', render: (v) => v.model || '–' },
        { label: 'Notes', render: (v) => v.notes || '–' },
      ]}
    />
  );
}
