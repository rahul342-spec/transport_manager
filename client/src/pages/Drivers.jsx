import MasterPage from '../components/MasterPage';
import { money } from '../lib/format';

export default function Drivers() {
  return (
    <MasterPage
      title="Drivers"
      subtitle="Salary here pre-fills when you record a salary expense."
      endpoint="/drivers"
      noun="Driver"
      searchPlaceholder="Search name or phone"
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'employeeId', label: 'Employee / reference ID' },
        { key: 'salary', label: 'Monthly salary (₹)', type: 'number' },
      ]}
      columns={[
        { label: 'Name', render: (d) => <span className="font-semibold">{d.name}</span> },
        { label: 'Phone', render: (d) => (d.phone ? <a className="underline" href={`tel:${d.phone}`} onClick={(e) => e.stopPropagation()}>{d.phone}</a> : '–') },
        { label: 'Employee ID', render: (d) => d.employeeId || '–' },
        { label: 'Salary', className: 'text-right', render: (d) => <span className="num">{d.salary ? money(d.salary) : '–'}</span> },
      ]}
    />
  );
}
