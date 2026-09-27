import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ---------- Page header ----------
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-asphalt-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------- Form field ----------
export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-asphalt-300">{hint}</span>}
      {error && <span className="mt-1 block text-sm text-loss">{error}</span>}
    </label>
  );
}

// ---------- Status badge ----------
const TONES = {
  Paid: 'bg-gain-soft text-gain',
  Partial: 'bg-hold-soft text-hold',
  Pending: 'bg-loss-soft text-loss',
  Active: 'bg-gain-soft text-gain',
  Inactive: 'bg-lane text-asphalt-500',
  Overdue: 'bg-loss text-white',
};
export function Badge({ children, tone }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-[13px] font-semibold ${TONES[tone || children] || 'bg-lane text-asphalt-500'}`}>
      {children}
    </span>
  );
}

// ---------- Feedback ----------
export function ErrorBox({ children }) {
  if (!children) return null;
  return <div className="mb-4 rounded-md border border-loss/30 bg-loss-soft px-4 py-3 text-loss">{children}</div>;
}

export function Loading() {
  return <div className="py-16 text-center text-asphalt-300">Loading…</div>;
}

export function Empty({ title, action }) {
  return (
    <div className="py-14 text-center">
      <p className="text-asphalt-500">{title}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({ open, title, onClose, children, footer, wide = false }) {
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const onCloseRef = useRef(onClose);

  // Always call the latest onClose without re-running the effect
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current?.();
    document.addEventListener('keydown', onKey);

    // Focus once when the modal opens: first field in the body, not the × button
    const first =
      bodyRef.current?.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ||
      ref.current?.querySelector('button');
    first?.focus();

    return () => document.removeEventListener('keydown', onKey);
  }, [open]); // only when open changes

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-asphalt/50 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-2xl leading-none text-asphalt-300 hover:text-asphalt" aria-label="Close">×</button>
        </div>
        <div ref={bodyRef} className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Table shell ----------
export function Table({ head, children, foot }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead className="bg-lane"><tr>{head}</tr></thead>
        <tbody>{children}</tbody>
        {foot && <tfoot className="bg-lane font-semibold">{foot}</tfoot>}
      </table>
    </div>
  );
}

// ---------- Toasts ----------
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-md px-4 py-2.5 text-[15px] font-medium shadow-lg ${t.tone === 'error' ? 'bg-loss text-white' : 'bg-asphalt text-white'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------- Period picker (month or custom range) ----------
export function PeriodPicker({ value, onChange }) {
  // value: { mode: 'month'|'range', month, from, to }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input w-auto" value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value })} aria-label="Period type">
        <option value="month">Month</option>
        <option value="range">Date range</option>
      </select>
      {value.mode === 'month' ? (
        <input type="month" className="input w-auto" value={value.month} onChange={(e) => onChange({ ...value, month: e.target.value })} aria-label="Month" />
      ) : (
        <>
          <input type="date" className="input w-auto" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} aria-label="From" />
          <span className="text-asphalt-300">to</span>
          <input type="date" className="input w-auto" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} aria-label="To" />
        </>
      )}
    </div>
  );
}
