import { motion } from 'framer-motion';
import { Apple, Settings, Wifi, WifiOff } from 'lucide-react';
import { IconButton } from '../ui/primitives';
import { spring } from '../ui/motion';

interface NavbarProps {
  /** Network reachability — the AI parser needs it. Logging never does. */
  isOnline: boolean;
  onOpenSettings?: () => void;
}

export default function Navbar({ isOnline, onOpenSettings }: NavbarProps) {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...spring, delay: 0.05 }}
      className="glass shrink-0 z-30 flex items-center justify-between border-b border-white/[0.06]"
      style={{
        height: 'var(--navbar-h)',
        paddingInline: 'clamp(14px, 4vw, 28px)',
      }}
    >
      {/* ── Brand ── */}
      <div className="flex items-center gap-2.5 min-w-0">
        <motion.div
          whileHover={{ rotate: [0, -10, 8, 0], scale: 1.06 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl grad-accent flex items-center justify-center shadow-glow shrink-0"
          style={{
            width: 'var(--avatar-sm)',
            height: 'var(--avatar-sm)',
            aspectRatio: '1',
          }}
        >
          <Apple style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} className="fill-black/10" />
        </motion.div>

        <div className="min-w-0">
          <h1
            className="font-extrabold text-fg-strong leading-none truncate"
            style={{ fontSize: 'var(--fs-md)' }}
          >
            FoodLog
          </h1>
          <motion.div
            key={String(isOnline)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1 mt-0.5"
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-accent shrink-0" />
                <span className="font-bold text-accent truncate" style={{ fontSize: 'var(--fs-xs)' }}>
                  Ready
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-fg-dim shrink-0" />
                <span className="font-bold text-fg-dim truncate" style={{ fontSize: 'var(--fs-xs)' }}>
                  Offline
                </span>
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-2 shrink-0">
        {onOpenSettings && (
          <IconButton label="Settings" onClick={onOpenSettings}>
            <Settings style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
          </IconButton>
        )}
      </div>
    </motion.header>
  );
}
