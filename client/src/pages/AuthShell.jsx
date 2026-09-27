// Shared frame for login / sign-up: a road running along the left edge
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[38%] flex-col justify-end bg-asphalt p-10 lg:flex">
        <div className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 flex-col justify-center gap-6" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => <span key={i} className="h-12 w-2 rounded-sm bg-sign/80" />)}
        </div>
        <p className="relative max-w-xs font-display text-3xl font-semibold leading-tight text-white">
          Every trip, payment and diesel bill in one place.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-asphalt-500">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-[15px] text-asphalt-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
