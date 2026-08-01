import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {Card, CountUp} from '../ui/primitives';
import { cx } from '../ui/cx';
import { cardIn, spring, stagger } from '../ui/motion';

interface DayMetric {
  date: string;
  calories: number;
}

interface HistoryStatsViewProps {
  streak: number;
  weeklyAverage: number;
  graphData: DayMetric[];
  selectedDate?: string;
  onSelectDay?: (date: string) => void;
}

export const HistoryStatsView: React.FC<HistoryStatsViewProps> = ({
  streak,
  weeklyAverage,
  graphData,
  selectedDate,
  onSelectDay,
}) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const maxCalories = Math.max(1500, ...graphData.map((d) => d.calories));

  // Formats date to simple weekday letter/abbreviation (e.g., "M", "T")
  const getDayLabel = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      return days[date.getDay()];
    } catch {
      return '';
    }
  };

  return (
    <motion.div variants={stagger(0.06)} className="w-full space-y-3">
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Card variants={cardIn} padded={false} className="p-3.5 flex items-center gap-2.5" interactive>
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-10 h-10 rounded-2xl grad-tile flex items-center justify-center shrink-0 shadow-soft text-lg"
            role="img"
            aria-hidden
          >
            🔥
          </motion.div>
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold text-fg-dim uppercase tracking-wide truncate">
              Streak
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-extrabold num text-fg-strong leading-tight">
                <CountUp value={streak} />
              </span>
              <span className="text-[11px] text-fg-dim font-bold">days</span>
            </div>
          </div>
        </Card>

        <Card variants={cardIn} padded={false} className="p-3.5 flex items-center gap-2.5" interactive>
          {/* Icon tiles stay uniformly dark — the white surface is reserved for
              active/primary states so it keeps its meaning. */}
          <div className="w-10 h-10 rounded-2xl grad-tile flex items-center justify-center shrink-0 shadow-soft text-lg" role="img" aria-hidden>
            📊
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold text-fg-dim uppercase tracking-wide truncate">
              Daily avg
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-extrabold num text-fg-strong leading-tight">
                <CountUp value={weeklyAverage} />
              </span>
              <span className="text-[10px] text-fg-dim font-bold">kcal</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Chart */}
      <Card variants={cardIn} className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-extrabold text-fg-base">Calorie intake</span>
          <span className="chip bg-surface-inset text-fg-muted px-2.5 py-1 text-[10px]">Last 7 days</span>
        </div>

        {graphData.length === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-fg-dim text-xs font-bold">
            No stats yet
          </div>
        ) : (
          <div className="flex items-end justify-between gap-1.5 h-[136px] pt-6 relative">
            {graphData.map((day, idx) => {
              const ratio = maxCalories > 0 ? day.calories / maxCalories : 0;
              const isToday = idx === graphData.length - 1;
              const isSelected = selectedDate === day.date;
              const isActive = isSelected || hovered === day.date;

              return (
                <button
                  key={day.date}
                  onClick={() => onSelectDay?.(day.date)}
                  onMouseEnter={() => setHovered(day.date)}
                  onMouseLeave={() => setHovered(null)}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group touch-manipulation"
                  aria-label={`${day.date}: ${day.calories} kcal`}
                >
                  {/* Tooltip */}
                  <AnimatePresence>
                    {isActive && day.calories > 0 && (
                      <motion.span
                        initial={{ opacity: 0, y: 6, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.9 }}
                        transition={spring}
                        className="absolute top-0 px-2 py-1 rounded-lg bg-accent text-surface-base
                                   text-[10px] font-extrabold num shadow-glow pointer-events-none z-10"
                      >
                        {day.calories} kcal
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Bar */}
                  <motion.div
                    className={cx(
                      'w-full rounded-t-xl rounded-b-md origin-bottom',
                      isSelected ? 'grad-accent' : isToday ? 'bg-accent-dim' : 'bg-surface-raised group-hover:bg-white/[0.14]'
                    )}
                    style={{ minHeight: 4 }}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(3, ratio * 100)}%` }}
                    transition={{ duration: 0.7, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ scaleY: 1.04 }}
                  />

                  <span
                    className={cx(
                      'text-[10px] font-extrabold shrink-0',
                      isSelected ? 'text-accent' : isToday ? 'text-fg-base' : 'text-fg-faint'
                    )}
                  >
                    {getDayLabel(day.date)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
};
