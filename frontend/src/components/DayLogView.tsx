import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FoodEntry } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {Card, CountUp, IconButton, Skeleton} from '../ui/primitives';
import { cx } from '../ui/cx';
import { cardIn, listItem, stagger } from '../ui/motion';

interface DayLogViewProps {
  dateString: string;
  items: FoodEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  totalSugar: number;
  totalFiber: number;
  onDeleteEntry: (id: string) => void;
  onSelectDate?: (date: string) => void;
  isLoading?: boolean;
}

const SUMMARY_TILES = [
  { key: 'protein', label: 'Protein', color: '#FFFFFF' },
  { key: 'carbs', label: 'Carbs', color: '#DCDCE0' },
  { key: 'fat', label: 'Fat', color: '#B8B8C0' },
  { key: 'fiber', label: 'Fiber', color: '#7E7E88' },
  { key: 'sugar', label: 'Sugar', color: '#9A9AA3' },
] as const;

export const DayLogView: React.FC<DayLogViewProps> = ({
  dateString,
  items,
  totalCalories,
  totalProtein,
  totalCarbs,
  totalFats,
  totalSugar,
  totalFiber,
  // `onDeleteEntry` stays in the props contract for the parent, but this view is
  // read-only, so it is intentionally not destructured here.
  onSelectDate,
  isLoading = false,
}) => {
  // Formats selected date string to readable text (e.g., 21 June 2026)
  const formatReadableDate = (dateStr: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', options);
    } catch {
      return dateStr;
    }
  };

  // Format created_at timestamp to locale time string (e.g., 1:10 PM)
  const formatLoggedTime = (createdAt?: string) => {
    if (!createdAt) return '—';
    try {
      const d = new Date(createdAt);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '—';
    }
  };

  const shiftDay = (delta: number) => {
    const d = new Date(dateString + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    onSelectDate?.(`${y}-${m}-${day}`);
  };

  const totals: Record<string, number> = {
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFats,
    fiber: totalFiber,
    sugar: totalSugar,
  };

  return (
    <motion.div variants={stagger(0.05)} className="w-full space-y-3">
      {/* Date header */}
      <div className="flex justify-between items-center px-1">
        <h4 className="text-sm font-extrabold text-fg-base">{formatReadableDate(dateString)}</h4>
        {onSelectDate && (
          <div className="flex items-center gap-1.5">
            <IconButton label="Previous day" onClick={() => shiftDay(-1)} className="p-1.5">
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.8} />
            </IconButton>
            <IconButton label="Next day" onClick={() => shiftDay(1)} className="p-1.5">
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.8} />
            </IconButton>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="loading" className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </motion.div>
        ) : items.length === 0 ? (
          <Card key="empty" variants={cardIn} initial="hidden" animate="show" className="flex flex-col items-center text-center py-8">
            <motion.span
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="text-3xl mb-2"
              role="img"
              aria-hidden
            >
              🗓️
            </motion.span>
            <p className="text-sm font-extrabold text-fg-base">Nothing logged</p>
            <p className="text-[11px] text-fg-dim font-bold mt-1">Pick another day from the calendar.</p>
          </Card>
        ) : (
          <motion.div
            key={dateString}
            variants={stagger(0.05)}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {/* Daily summary */}
            <Card variants={cardIn} className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] font-extrabold text-fg-dim uppercase tracking-wide">
                  Daily summary
                </span>
                <span className="text-xl font-extrabold num text-accent">
                  <CountUp value={totalCalories} suffix=" kcal" />
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {SUMMARY_TILES.map((tile) => (
                  <div
                    key={tile.key}
                    className="flex flex-col items-center py-2 px-1 rounded-xl"
                    style={{ backgroundColor: `${tile.color}14` }}
                  >
                    <span className="text-xs font-extrabold num" style={{ color: tile.color }}>
                      {totals[tile.key]}g
                    </span>
                    <span className="text-[8px] text-fg-dim uppercase tracking-wide mt-0.5 font-extrabold">
                      {tile.label}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Timeline of entries */}
            <div className="relative pl-4">
              {/* The spine */}
              <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-surface-raised rounded-full" />

              <div className="space-y-2.5">
                {items.map((item) => (
                  <motion.div key={item.id} variants={listItem} className="relative">
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1 }}
                      className="absolute -left-4 top-4 w-2.5 h-2.5 rounded-full grad-accent ring-4 ring-surface-card"
                    />

                    <div className="card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-extrabold text-fg-strong capitalize truncate"
                            title={item.name}
                          >
                            {item.name}
                          </p>
                          <p className="text-[10px] text-fg-dim font-bold num mt-0.5">
                            {item.quantity} {item.unit} · {formatLoggedTime(item.createdAt)}
                          </p>
                        </div>
                        <span className="chip bg-white/[0.06] text-accent px-2 py-0.5 text-[10px] num shrink-0">
                          {item.calories} kcal
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {[
                          { l: 'P', v: item.protein, c: '#FFFFFF' },
                          { l: 'C', v: item.carbs, c: '#DCDCE0' },
                          { l: 'F', v: item.fats, c: '#B8B8C0' },
                          { l: 'S', v: item.sugar || 0, c: '#9A9AA3' },
                          { l: 'Fib', v: item.fiber || 0, c: '#7E7E88' },
                        ].map((m) => (
                          <span
                            key={m.l}
                            className={cx('chip px-1.5 py-0.5 text-[9px]')}
                            style={{ backgroundColor: `${m.c}14`, color: m.c }}
                          >
                            {m.l} {m.v}g
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
