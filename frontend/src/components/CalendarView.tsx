import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fromIsoDate, monthTransition } from '../utils/date';
import {IconButton} from '../ui/primitives';
import { cx } from '../ui/cx';
import { monthSlide, spring } from '../ui/motion';

interface CalendarViewProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  loggedDays: string[]; // List of YYYY-MM-DD strings with logs
  onMonthChange: (monthStr: string) => void; // Called with YYYY-MM when month changes
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedDate,
  onSelectDate,
  loggedDays,
  onMonthChange,
}) => {
  const today = new Date();
  const [view, setView] = useState<{ date: Date; direction: number }>(() => ({
    date: fromIsoDate(selectedDate),
    direction: 0,
  }));

  /**
   * Following the selected date into another month is derived during render,
   * not done in an effect. Setting state from an effect made every date change
   * render twice and paint the old month for a frame.
   */
  const jump = monthTransition(selectedDate, view.date.getFullYear(), view.date.getMonth());
  if (jump) {
    setView({ date: new Date(jump.year, jump.month, 1), direction: jump.direction });
  }

  const currentDate = jump ? new Date(jump.year, jump.month, 1) : view.date;
  const direction = jump ? jump.direction : view.direction;

  // Tell the parent which month to load. This is a genuine side effect — it
  // reaches outside React — so it belongs in an effect.
  const visibleMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  useEffect(() => {
    onMonthChange(visibleMonth);
  }, [visibleMonth, onMonthChange]);

  const handlePrevMonth = () => {
    setView({ date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1), direction: -1 });
  };

  const handleNextMonth = () => {
    setView({ date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1), direction: 1 });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Construct day cells
  const cells: { dateStr: string | null; dayNum: number | null; isToday: boolean; hasLog: boolean; isSelected: boolean }[] = [];

  // Empty cells for alignment before first day of month
  for (let i = 0; i < firstDay; i++) {
    cells.push({ dateStr: null, dayNum: null, isToday: false, hasLog: false, isSelected: false });
  }

  // Actual day cells
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  for (let day = 1; day <= daysInMonth; day++) {
    const cellDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const isToday =
      day === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear();

    const isSelected = cellDateStr === selectedDate;
    const hasLog = loggedDays.includes(cellDateStr);

    cells.push({ dateStr: cellDateStr, dayNum: day, isToday, hasLog, isSelected });
  }

  const monthKey = `${currentYear}-${currentMonth}`;

  return (
    <div className="w-full card p-4 space-y-3.5 select-none">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.h4
              key={monthKey}
              custom={direction}
              variants={monthSlide}
              initial="enter"
              animate="center"
              exit="exit"
              className="text-base font-extrabold text-fg-strong"
            >
              {monthNames[currentMonth]}{' '}
              <span className="text-fg-dim font-bold">{currentYear}</span>
            </motion.h4>
          </AnimatePresence>
        </div>

        <div className="flex gap-1.5">
          <IconButton label="Previous month" onClick={handlePrevMonth} className="p-1.5">
            <ChevronLeft className="w-4 h-4" strokeWidth={2.8} />
          </IconButton>
          <IconButton label="Next month" onClick={handleNextMonth} className="p-1.5">
            <ChevronRight className="w-4 h-4" strokeWidth={2.8} />
          </IconButton>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {daysOfWeek.map((d) => (
          <span key={d} className="text-[10px] font-extrabold text-fg-faint uppercase tracking-wide">
            {d}
          </span>
        ))}
      </div>

      {/* Month grid */}
      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={monthKey}
            custom={direction}
            variants={monthSlide}
            initial="enter"
            animate="center"
            exit="exit"
            className="grid grid-cols-7 gap-y-1.5 gap-x-0.5 text-center"
          >
            {cells.map((cell, idx) => {
              if (!cell.dayNum || !cell.dateStr) {
                return <div key={`empty-${idx}`} />;
              }

              return (
                <motion.button
                  key={cell.dateStr}
                  onClick={() => onSelectDate(cell.dateStr!)}
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.9 }}
                  transition={spring}
                  className="relative mx-auto w-9 h-9 rounded-2xl flex flex-col items-center justify-center
                             cursor-pointer font-bold num touch-manipulation"
                  aria-label={cell.dateStr}
                  aria-current={cell.isSelected ? 'date' : undefined}
                >
                  {/* The selected pill glides between days */}
                  {cell.isSelected && (
                    <motion.span
                      layoutId="calendar-selected"
                      transition={spring}
                      className="absolute inset-0 rounded-2xl grad-accent shadow-glow"
                    />
                  )}

                  {!cell.isSelected && cell.isToday && (
                    <span className="absolute inset-0 rounded-2xl border-2 border-white/30" />
                  )}

                  <span
                    className={cx(
                      'relative text-xs leading-none',
                      cell.isSelected
                        ? 'text-surface-base'
                        : cell.isToday
                          ? 'text-accent font-extrabold'
                          : cell.hasLog
                            ? 'text-fg-strong'
                            : 'text-fg-faint'
                    )}
                  >
                    {cell.dayNum}
                  </span>

                  {cell.hasLog && (
                    <motion.span
                      layout
                      className={cx(
                        'relative mt-0.5 w-1.5 h-1.5 rounded-full',
                        cell.isSelected ? 'bg-surface-base/70' : 'bg-accent-dim'
                      )}
                    />
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
