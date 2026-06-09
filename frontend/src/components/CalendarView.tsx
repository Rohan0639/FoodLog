import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [currentDate, setCurrentDate] = useState<Date>(new Date(selectedDate));

  useEffect(() => {
    // Notify parent of initial month
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    onMonthChange(`${year}-${month}`);
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
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

    cells.push({
      dateStr: cellDateStr,
      dayNum: day,
      isToday,
      hasLog,
      isSelected,
    });
  }

  return (
    <div className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl p-4 space-y-4 shadow-sm text-white select-none">
      {/* Calendar Header: Month/Year navigation */}
      <div className="flex justify-between items-center px-1">
        <h4 className="text-sm font-bold tracking-tight text-white font-sans">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h4>
        <div className="flex gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-lg border border-zinc-900 bg-zinc-950 text-zinc-400 hover:text-white transition-all duration-150 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-lg border border-zinc-900 bg-zinc-950 text-zinc-400 hover:text-white transition-all duration-150 active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Body */}
      <div className="grid grid-cols-7 gap-y-2 text-center text-xs">
        {/* Days of week headers */}
        {daysOfWeek.map((d) => (
          <span key={d} className="text-[10px] font-black text-zinc-600 uppercase tracking-wider font-mono">
            {d}
          </span>
        ))}

        {/* Day cells grid */}
        {cells.map((cell, idx) => {
          if (!cell.dayNum || !cell.dateStr) {
            return <div key={`empty-${idx}`} />;
          }

          return (
            <div
              key={cell.dateStr}
              onClick={() => onSelectDate(cell.dateStr!)}
              className={`relative py-1.5 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-150 group font-mono font-medium ${
                cell.isSelected
                  ? 'bg-[#FF7E67] text-white font-bold shadow-md scale-105 z-10'
                  : cell.isToday
                  ? 'border border-white/60 text-white font-bold'
                  : 'hover:bg-zinc-900/60 text-zinc-300 hover:text-white'
              }`}
            >
              <span className="text-xs">{cell.dayNum}</span>
              
              {/* Highlight dot for logged days */}
              {cell.hasLog && (
                <span
                  className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                    cell.isSelected ? 'bg-white' : 'bg-[#FF7E67]'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
