import React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cardIn, easeFast, hoverLift, spring, tapScale } from './motion';
import { cx } from './cx';

/**
 * The app's UI kit.
 *
 * Every screen composes these rather than repeating Tailwind strings, so a
 * change to the look of "a card" or "a primary button" happens in one place.
 */

// ─── Card ──────────────────────────────────────────────────────────────────
type CardProps = HTMLMotionProps<'div'> & {
  interactive?: boolean;
  inset?: boolean;
  padded?: boolean;
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive, inset, padded = true, children, ...rest },
  ref
) {
  return (
    <motion.div
      ref={ref}
      variants={cardIn}
      className={cx(
        inset ? 'card-inset' : 'card',
        padded && 'p-4 sm:p-5',
        interactive && 'cursor-pointer',
        className
      )}
      {...(interactive ? { whileHover: hoverLift, whileTap: tapScale } : {})}
      {...rest}
    >
      {children}
    </motion.div>
  );
});

// ─── Button ────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'grad-accent shadow-glow hover:shadow-glow-lg',
  secondary: 'grad-accent shadow-glow',
  soft: 'bg-surface-inset text-fg-base border-2 border-surface-line hover:border-white/[0.14] hover:text-accent',
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-inset hover:text-fg-strong',
  danger: 'bg-surface-card text-accent border-2 border-white/[0.14] hover:bg-white/[0.06]',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-2 text-xs rounded-xl gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-2xl gap-2',
  lg: 'px-5 py-3.5 text-base rounded-2.5xl gap-2',
};

type ButtonProps = Omit<HTMLMotionProps<'button'>, 'ref'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, className, children, disabled, ...rest },
  ref
) {
  return (
    <motion.button
      ref={ref}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.03, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={spring}
      className={cx(
        'inline-flex items-center justify-center font-extrabold font-display tracking-tight',
        'transition-colors duration-200 select-none touch-manipulation',
        'disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
});

// ─── Icon button ───────────────────────────────────────────────────────────
type IconButtonProps = Omit<HTMLMotionProps<'button'>, 'ref'> & {
  label: string;
  tone?: 'neutral' | 'coral' | 'plain';
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, tone = 'neutral', className, children, ...rest }, ref) {
    const tones = {
      neutral: 'bg-surface-card border-2 border-surface-line text-fg-muted hover:text-accent hover:border-white/[0.14] shadow-soft',
      coral: 'grad-accent shadow-glow',
      plain: 'text-fg-dim hover:text-fg-strong hover:bg-surface-inset',
    };
    return (
      <motion.button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.9 }}
        transition={spring}
        className={cx(
          'inline-flex items-center justify-center rounded-full p-2 touch-manipulation',
          'transition-colors duration-200',
          tones[tone],
          className
        )}
        {...rest}
      >
        {children}
      </motion.button>
    );
  }
);

// ─── Chip ──────────────────────────────────────────────────────────────────
export const Chip: React.FC<{
  children: React.ReactNode;
  color?: string;
  className?: string;
}> = ({ children, color, className }) => (
  <span
    className={cx('chip px-2.5 py-1 text-[11px] leading-none', className)}
    style={color ? { backgroundColor: `${color}1F`, color } : undefined}
  >
    {children}
  </span>
);

// ─── Section heading ───────────────────────────────────────────────────────
export const SectionTitle: React.FC<{
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, children, action, className }) => (
  <div className={cx('flex items-center justify-between gap-3 px-1', className)}>
    <h3 className="flex items-center gap-2 text-sm font-extrabold text-fg-base">
      {icon}
      {children}
    </h3>
    {action}
  </div>
);

// ─── Count-up number ───────────────────────────────────────────────────────
/**
 * Animates from the previous value to the next one.
 *
 * Uses a rAF loop writing to a ref rather than React state, so a counter
 * ticking through 60 frames does not trigger 60 re-renders of its parent.
 */
export const CountUp: React.FC<{
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  suffix?: string;
}> = ({ value, decimals = 0, duration = 0.7, className, suffix = '' }) => {
  const nodeRef = React.useRef<HTMLSpanElement>(null);
  const fromRef = React.useRef(0);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const from = fromRef.current;
    const to = Number.isFinite(value) ? value : 0;
    fromRef.current = to;

    if (reduce || from === to) {
      node.textContent = to.toFixed(decimals) + suffix;
      return;
    }

    let raf = 0;
    const start = performance.now();
    const ms = duration * 1000;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      node.textContent = (from + (to - from) * eased).toFixed(decimals) + suffix;
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals, duration, suffix, reduce]);

  return <span ref={nodeRef} className={cx('num', className)}>{`0${suffix}`}</span>;
};

// ─── Progress ring ─────────────────────────────────────────────────────────
export const ProgressRing: React.FC<{
  progress: number; // 0..1
  size?: number;
  stroke?: number;
  gradientId?: string;
  from?: string;
  to?: string;
  trackClassName?: string;
  children?: React.ReactNode;
}> = ({
  progress,
  size = 180,
  stroke = 16,
  gradientId = 'ring-grad',
  from = '#FFFFFF',
  to = '#A1A1AA',
  trackClassName = 'stroke-surface-raised',
  children,
}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={trackClassName}
          strokeLinecap="round"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
};

// ─── Progress bar ──────────────────────────────────────────────────────────
export const ProgressBar: React.FC<{
  progress: number;
  color: string;
  className?: string;
  delay?: number;
}> = ({ progress, color, className, delay = 0 }) => (
  <div className={cx('w-full h-2.5 bg-surface-raised rounded-full overflow-hidden', className)}>
    <motion.div
      className="h-full rounded-full"
      style={{ backgroundColor: color }}
      initial={{ width: 0 }}
      animate={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay }}
    />
  </div>
);

// ─── Skeleton ──────────────────────────────────────────────────────────────
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cx('skeleton', className)} />
);

// ─── Floating background blobs ─────────────────────────────────────────────
/**
 * Ambient colour behind the app. `pointer-events-none` and transform-only
 * animation, so it never intercepts taps or triggers layout.
 */
export const Blobs: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cx('pointer-events-none fixed inset-0 overflow-hidden -z-10', className)} aria-hidden>
    {/* On black, ambient light reads as a faint lift rather than colour. */}
    <div className="absolute -top-32 -left-24 w-[46vw] h-[46vw] max-w-[420px] max-h-[420px] rounded-full bg-white/[0.045] blur-3xl animate-blob" />
    <div
      className="absolute top-1/3 -right-28 w-[42vw] h-[42vw] max-w-[380px] max-h-[380px] rounded-full bg-white/[0.035] blur-3xl animate-blob"
      style={{ animationDelay: '-6s' }}
    />
    <div
      className="absolute -bottom-32 left-1/4 w-[40vw] h-[40vw] max-w-[360px] max-h-[360px] rounded-full bg-white/[0.03] blur-3xl animate-blob"
      style={{ animationDelay: '-12s' }}
    />
  </div>
);

// ─── Modal shell ───────────────────────────────────────────────────────────
/**
 * Centred dialog on desktop, bottom sheet on phones. Closes on backdrop click
 * and on Escape, and locks the page behind it.
 */
export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
  className?: string;
}> = ({ open, onClose, children, labelledBy, className }) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={easeFast}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-fg-strong/40 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={spring}
        onClick={(e) => e.stopPropagation()}
        className={cx(
          'relative w-full sm:max-w-md bg-surface-card shadow-soft-lg',
          'rounded-t-4xl sm:rounded-4xl max-h-[92dvh] overflow-hidden flex flex-col',
          className
        )}
      >
        {/* Grab handle — the affordance for the sheet form on phones */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-11 h-1.5 rounded-full bg-surface-line" />
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
};

// ─── Confirm dialog ────────────────────────────────────────────────────────
export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', icon, onConfirm, onCancel }) => (
  <Modal open={open} onClose={onCancel} className="sm:max-w-sm">
    <div className="p-6 text-center">
      {icon && (
        <motion.div
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ ...spring, delay: 0.05 }}
          className="w-16 h-16 rounded-3xl grad-accent shadow-glow flex items-center justify-center mx-auto mb-4"
        >
          {icon}
        </motion.div>
      )}
      <h3 className="text-lg font-extrabold text-fg-strong">{title}</h3>
      <p className="text-sm text-fg-muted font-semibold mt-2 leading-relaxed">{message}</p>
      <div className="flex gap-2.5 mt-6">
        <Button variant="soft" size="md" fullWidth onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="primary" size="md" fullWidth onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  </Modal>
);
