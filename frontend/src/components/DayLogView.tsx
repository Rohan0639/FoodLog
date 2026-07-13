import React from 'react';
import type { FoodEntry } from '../types';
import { Target, ChevronLeft, ChevronRight } from 'lucide-react';

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

export const DayLogView: React.FC<DayLogViewProps> = ({
  dateString,
  items,
  totalCalories,
  totalProtein,
  totalCarbs,
  totalFats,
  totalSugar,
  totalFiber,
  // onDeleteEntry is kept in the interface for backwards compatibility but not used in read-only view
  onDeleteEntry: _onDeleteEntry,
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

  return (
    <div className="w-full space-y-4 font-sans text-zinc-100">
      {/* Date Header Title with Prev/Next Navigation */}
      <div className="flex justify-between items-center px-1">
        <h4 className="text-xs font-bold text-zinc-400">
          {formatReadableDate(dateString)}
        </h4>
        {onSelectDate && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const d = new Date(dateString + 'T00:00:00');
                d.setDate(d.getDate() - 1);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                onSelectDate(`${y}-${m}-${day}`);
              }}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all duration-150 active:scale-95"
              title="Previous day"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                const d = new Date(dateString + 'T00:00:00');
                d.setDate(d.getDate() + 1);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                onSelectDate(`${y}-${m}-${day}`);
              }}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all duration-150 active:scale-95"
              title="Next day"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-zinc-500 text-xs animate-pulse">
          Loading logs…
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-zinc-800 rounded-2xl text-center bg-zinc-900/40">
          <Target className="w-6 h-6 text-zinc-600 mb-2" />
          <p className="text-xs text-zinc-400 font-semibold">No food logs for this date.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Daily Nutrition Summary */}
          <div className="p-3.5 sm:p-4 card space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Daily Summary
              </span>
              <span className="text-xl font-bold num text-white">
                {totalCalories} <span className="text-xs text-zinc-500 font-medium">kcal</span>
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-[10px] text-zinc-400 num">
              <div className="flex flex-col items-center p-2 card-inset">
                <span className="text-white font-bold">{totalProtein}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5 font-semibold">Protein</span>
              </div>
              <div className="flex flex-col items-center p-2 card-inset">
                <span className="text-white font-bold">{totalCarbs}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5 font-semibold">Carbs</span>
              </div>
              <div className="flex flex-col items-center p-2 card-inset">
                <span className="text-white font-bold">{totalFats}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5 font-semibold">Fat</span>
              </div>
              <div className="flex flex-col items-center p-2 card-inset">
                <span className="text-white font-bold">{totalFiber}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5 font-semibold">Fiber</span>
              </div>
              <div className="flex flex-col items-center p-2 card-inset">
                <span className="text-white font-bold">{totalSugar}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5 font-semibold">Sugar</span>
              </div>
            </div>
          </div>

          {/* Food Log Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px] sm:text-xs num">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-800">
                    <th className="px-3 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Food</th>
                    <th className="px-2 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Qty</th>
                    <th className="px-2 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Cal</th>
                    <th className="px-2 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Protein</th>
                    <th className="px-2 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Carbs</th>
                    <th className="px-2 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Fat</th>
                    <th className="px-2 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Fiber</th>
                    <th className="px-2 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Sugar</th>
                    <th className="px-2 py-2.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`border-b border-zinc-800/60 transition-colors duration-100 hover:bg-zinc-800/40 ${
                        idx % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-950/60'
                      }`}
                    >
                      <td className="px-3 py-2 text-zinc-200 font-semibold capitalize whitespace-nowrap max-w-[120px] truncate" title={item.name}>
                        {item.name}
                      </td>
                      <td className="px-2 py-2 text-zinc-500 whitespace-nowrap">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-2 py-2 text-white font-bold text-right whitespace-nowrap">
                        {item.calories}
                      </td>
                      <td className="px-2 py-2 text-zinc-400 text-right whitespace-nowrap">
                        {item.protein}g
                      </td>
                      <td className="px-2 py-2 text-zinc-400 text-right whitespace-nowrap">
                        {item.carbs}g
                      </td>
                      <td className="px-2 py-2 text-zinc-400 text-right whitespace-nowrap">
                        {item.fats}g
                      </td>
                      <td className="px-2 py-2 text-zinc-400 text-right whitespace-nowrap">
                        {item.fiber || 0}g
                      </td>
                      <td className="px-2 py-2 text-zinc-400 text-right whitespace-nowrap">
                        {item.sugar || 0}g
                      </td>
                      <td className="px-2 py-2 text-zinc-500 text-right whitespace-nowrap">
                        {formatLoggedTime(item.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
