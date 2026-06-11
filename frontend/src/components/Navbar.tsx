import { Apple, LogOut, BarChart2 } from 'lucide-react';

interface NavbarProps {
  userEmail?: string;
  isOnline: boolean | null;
  onLogout: () => void;
  isDashboardOpenMobile: boolean;
  setIsDashboardOpenMobile: (open: boolean) => void;
  hasLogs: boolean;
}

export default function Navbar({
  userEmail,
  isOnline,
  onLogout,
  isDashboardOpenMobile,
  setIsDashboardOpenMobile,
  hasLogs,
}: NavbarProps) {
  return (
    <header
      className="border-b border-zinc-900 bg-black/90 backdrop-blur-md shrink-0 z-20 flex items-center justify-between"
      style={{
        height: 'var(--navbar-h)',
        paddingInline: 'clamp(10px, 3vw, 24px)',
      }}
    >
      {/* ── Brand ── */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="rounded-lg bg-white flex items-center justify-center text-black shadow shrink-0"
          style={{
            width: 'var(--avatar-sm)',
            height: 'var(--avatar-sm)',
            aspectRatio: '1',
          }}
        >
          <Apple style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="fill-black/10" />
        </div>

        <div className="min-w-0">
          <h1
            className="font-bold text-white leading-none truncate"
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            FoodLog Assistant
          </h1>
          <div className="flex items-center gap-1.5 mt-1">
            {isOnline === null ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />
                <span className="font-bold uppercase tracking-wider text-yellow-400 truncate" style={{ fontSize: 'var(--fs-xs)' }}>
                  Connecting...
                </span>
              </>
            ) : isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="font-bold uppercase tracking-wider text-emerald-400 truncate" style={{ fontSize: 'var(--fs-xs)' }}>
                  Online
                </span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span className="font-bold uppercase tracking-wider text-red-400 truncate" style={{ fontSize: 'var(--fs-xs)' }}>
                  Offline
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {userEmail && (
          <span
            className="hidden sm:inline-block text-zinc-400 font-medium truncate max-w-[140px]"
            style={{ fontSize: 'var(--fs-xs)' }}
          >
            {userEmail}
          </span>
        )}

        <button
          onClick={onLogout}
          className="rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white hover:border-zinc-700 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all duration-150 font-semibold"
          style={{ padding: 'clamp(6px,1.5vw,8px) clamp(8px,2vw,12px)', fontSize: 'var(--fs-xs)' }}
          title="Sign Out"
        >
          <LogOut style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} />
          <span className="hidden md:inline">Sign Out</span>
        </button>

        {/* Mobile Stats Toggle */}
        <button
          onClick={() => setIsDashboardOpenMobile(!isDashboardOpenMobile)}
          className="lg:hidden rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all duration-150"
          style={{ padding: 'clamp(6px,1.5vw,8px) clamp(8px,2vw,12px)' }}
        >
          <BarChart2
            style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }}
            className="text-white"
          />
          <span
            className="font-bold hidden min-[370px]:inline"
            style={{ fontSize: 'var(--fs-xs)' }}
          >
            Stats
          </span>
          {hasLogs && (
            <span className="w-2 h-2 rounded-full bg-white shrink-0" />
          )}
        </button>
      </div>
    </header>
  );
}
