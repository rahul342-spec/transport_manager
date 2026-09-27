// Minimal CSV writer: columns = [{ key, label }]
function toCSV(columns, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(',')).join('\n');
  return `${head}\n${body}`;
}
module.exports = { toCSV };
