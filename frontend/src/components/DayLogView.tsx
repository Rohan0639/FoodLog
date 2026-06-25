import React from 'react';
import type { FoodEntry } from '../types';
import { Target } from 'lucide-react';

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
    <div className="w-full space-y-4 font-sans text-white">
      {/* Date Header Title */}
      <div className="flex justify-between items-baseline px-1">
        <h4 className="text-xs font-black tracking-widest text-zinc-500 uppercase font-mono">
          Logs for {formatReadableDate(dateString)}
        </h4>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-zinc-500 text-xs font-mono animate-pulse">
          Loading logs...
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-zinc-900 rounded-2xl text-center">
          <Target className="w-6 h-6 text-zinc-600 mb-2" />
          <p className="text-xs text-zinc-400 font-semibold">No food logs found for this date.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Daily Nutrition Summary */}
          <div className="p-3 sm:p-4 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-2.5 shadow-inner">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider font-mono">
                Daily Nutrition Summary
              </span>
              <span className="text-xl font-bold font-mono text-white">
                {totalCalories} <span className="text-xs text-zinc-500 font-mono">kcal</span>
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-[10px] text-zinc-400 font-mono">
              <div className="flex flex-col items-center p-1.5 bg-black rounded-lg border border-zinc-900">
                <span className="text-zinc-200 font-semibold">{totalProtein}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5">Protein</span>
              </div>
              <div className="flex flex-col items-center p-1.5 bg-black rounded-lg border border-zinc-900">
                <span className="text-zinc-200 font-semibold">{totalCarbs}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5">Carbs</span>
              </div>
              <div className="flex flex-col items-center p-1.5 bg-black rounded-lg border border-zinc-900">
                <span className="text-zinc-200 font-semibold">{totalFats}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5">Fat</span>
              </div>
              <div className="flex flex-col items-center p-1.5 bg-black rounded-lg border border-zinc-900">
                <span className="text-zinc-200 font-semibold">{totalFiber}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5">Fiber</span>
              </div>
              <div className="flex flex-col items-center p-1.5 bg-black rounded-lg border border-zinc-900">
                <span className="text-zinc-200 font-semibold">{totalSugar}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5">Sugar</span>
              </div>
            </div>
          </div>

          {/* Food Log Table */}
          <div className="rounded-2xl border border-zinc-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px] sm:text-xs font-mono">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-900">
                    <th className="px-3 py-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap">Food</th>
                    <th className="px-2 py-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap">Qty</th>
                    <th className="px-2 py-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Cal</th>
                    <th className="px-2 py-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Protein</th>
                    <th className="px-2 py-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Carbs</th>
                    <th className="px-2 py-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Fat</th>
                    <th className="px-2 py-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Fiber</th>
                    <th className="px-2 py-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Sugar</th>
                    <th className="px-2 py-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`border-b border-zinc-900/60 transition-colors duration-100 hover:bg-zinc-900/40 ${
                        idx % 2 === 0 ? 'bg-black' : 'bg-zinc-950/50'
                      }`}
                    >
                      <td className="px-3 py-2 text-zinc-200 font-semibold capitalize whitespace-nowrap max-w-[120px] truncate" title={item.name}>
                        {item.name}
                      </td>
                      <td className="px-2 py-2 text-zinc-400 whitespace-nowrap">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-2 py-2 text-white font-bold text-right whitespace-nowrap">
                        {item.calories}
                      </td>
                      <td className="px-2 py-2 text-zinc-300 text-right whitespace-nowrap">
                        {item.protein}g
                      </td>
                      <td className="px-2 py-2 text-zinc-300 text-right whitespace-nowrap">
                        {item.carbs}g
                      </td>
                      <td className="px-2 py-2 text-zinc-300 text-right whitespace-nowrap">
                        {item.fats}g
                      </td>
                      <td className="px-2 py-2 text-zinc-300 text-right whitespace-nowrap">
                        {item.fiber || 0}g
                      </td>
                      <td className="px-2 py-2 text-zinc-300 text-right whitespace-nowrap">
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
