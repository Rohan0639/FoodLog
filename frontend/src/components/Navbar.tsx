import { Apple, LogOut } from 'lucide-react';

interface NavbarProps {
  userEmail?: string;
  isOnline: boolean | null;
  onLogout: () => void;
}

export default function Navbar({
  userEmail,
  isOnline,
  onLogout,
}: NavbarProps) {
  return (
    <header
      className="border-b border-zinc-800/80 glass shrink-0 z-20 flex items-center justify-between"
      style={{
        height: 'var(--navbar-h)',
        paddingInline: 'clamp(10px, 3vw, 24px)',
      }}
    >
      {/* ── Brand ── */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="rounded-xl bg-white flex items-center justify-center text-black shadow-white-sm shrink-0"
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
            className="font-bold text-white leading-none truncate tracking-tight"
            style={{ fontSize: 'var(--fs-md)' }}
          >
            FoodLog
          </h1>
          <div className="flex items-center gap-1.5 mt-1">
            {isOnline === null ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse shrink-0" />
                <span className="font-semibold text-zinc-400 truncate" style={{ fontSize: 'var(--fs-xs)' }}>
                  Connecting…
                </span>
              </>
            ) : isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                <span className="font-semibold text-zinc-300 truncate" style={{ fontSize: 'var(--fs-xs)' }}>
                  Online
                </span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                <span className="font-semibold text-zinc-500 truncate" style={{ fontSize: 'var(--fs-xs)' }}>
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
            className="hidden sm:inline-block text-zinc-500 font-medium truncate max-w-[140px]"
            style={{ fontSize: 'var(--fs-xs)' }}
          >
            {userEmail}
          </span>
        )}

        <button
          onClick={onLogout}
          className="rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-600 flex items-center gap-1.5 shadow-soft active:scale-95 transition-all duration-150 font-semibold"
          style={{ padding: 'clamp(6px,1.5vw,8px) clamp(8px,2vw,12px)', fontSize: 'var(--fs-xs)' }}
          title="Sign Out"
        >
          <LogOut style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} />
          <span className="hidden md:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
