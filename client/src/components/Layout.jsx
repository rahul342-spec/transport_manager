import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/work', label: 'Daily work' },
  { to: '/payments', label: 'Payments' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/reports', label: 'Reports' },
  { divider: true },
  { to: '/clients', label: 'Clients' },
  { to: '/vehicles', label: 'Vehicles' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/settings', label: 'Business settings' },
];

export default function Layout() {
  const { business, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3" onClick={() => setOpen(false)}>
      {NAV.map((n, i) =>
        n.divider ? (
          <div key={`d${i}`} className="my-3 border-t border-asphalt-700" />
        ) : (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-[15px] font-medium transition-colors ${
                isActive ? 'bg-sign text-asphalt' : 'text-white/80 hover:bg-asphalt-700 hover:text-white'
              }`
            }
          >
            {n.label}
          </NavLink>
        )
      )}
    </nav>
  );

  const brand = (
    <div className="px-6 pb-5 pt-6">
      {/* lane marking under the business name */}
      <div className="font-display text-xl font-semibold leading-tight text-white">{business?.name || 'Transport Manager'}</div>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        <span className="h-1 w-6 rounded-sm bg-sign" />
        <span className="h-1 w-6 rounded-sm bg-sign" />
        <span className="h-1 w-6 rounded-sm bg-sign" />
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-asphalt-700 px-6 py-4 text-sm">
      <div className="truncate text-white/80">{user?.name}</div>
      <button type="button" onClick={logout} className="mt-1 font-semibold text-sign hover:underline">Log out</button>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-asphalt lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-asphalt px-4 py-3 lg:hidden">
        <span className="font-display text-lg font-semibold text-white">{business?.name}</span>
        <button type="button" onClick={() => setOpen(true)} className="rounded border border-asphalt-500 px-3 py-1 text-sm font-semibold text-white">Menu</button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-64 flex-col bg-asphalt" onClick={(e) => e.stopPropagation()}>
            {brand}
            {nav}
            {footer}
          </aside>
          <div className="flex-1 bg-asphalt/50" />
        </div>
      )}

      <main key={loc.pathname} className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
    </div>
  );
}
