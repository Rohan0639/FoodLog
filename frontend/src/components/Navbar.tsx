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
    <header className="h-16 border-b border-zinc-900 px-3 min-[370px]:px-4 sm:px-6 flex items-center justify-between bg-black/90 backdrop-blur-md shrink-0 z-20">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black shadow">
          <Apple className="w-5 h-5 fill-black/10" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white leading-none">FoodLog Assistant</h1>
          <div className="flex items-center gap-1.5 mt-1">
            {isOnline === null ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">Connecting...</span>
              </>
            ) : isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Online</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Offline</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-4">
        {userEmail && (
          <span className="hidden sm:inline-block text-xs text-zinc-400 font-medium">
            {userEmail}
          </span>
        )}

        <button
          onClick={onLogout}
          className="p-2 rounded-xl border border-zinc-850 bg-zinc-900/80 text-zinc-400 hover:text-white hover:border-zinc-750 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all duration-150 text-xs font-semibold"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">Sign Out</span>
        </button>

        {/* Collapsible Mobile Dashboard Trigger */}
        <button
          onClick={() => setIsDashboardOpenMobile(!isDashboardOpenMobile)}
          className="lg:hidden p-2 rounded-xl border border-zinc-850 bg-zinc-900/80 text-zinc-350 hover:text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all duration-150"
        >
          <BarChart2 className="w-4.5 h-4.5 text-white" />
          <span className="text-xs font-bold hidden min-[370px]:inline">Stats</span>
          {hasLogs && (
            <span className="w-2 h-2 rounded-full bg-white shrink-0" />
          )}
        </button>
      </div>
    </header>
  );
}
