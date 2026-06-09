import React, { useState } from 'react';
import type { FoodEntry } from '../types';
import { Target, Trash2, AlertTriangle } from 'lucide-react';

interface DayLogViewProps {
  dateString: string;
  items: FoodEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
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
  onDeleteEntry,
  isLoading = false,
}) => {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Formats selected date string to more readable text (e.g., June 9, 2026)
  const formatReadableDate = (dateStr: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
      return new Date(dateStr).toLocaleDateString('en-US', options);
    } catch {
      return dateStr;
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
        <div className="py-8 text-center text-zinc-550 text-xs font-mono animate-pulse">
          Loading logs...
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-zinc-900 rounded-2xl text-center">
          <Target className="w-6 h-6 text-zinc-650 mb-2" />
          <p className="text-xs text-zinc-450 font-semibold">No logs for this day</p>
          <p className="text-[10px] text-zinc-600 mt-1 max-w-[170px] font-medium leading-relaxed">
            There are no recorded food entries on this calendar date.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Daily macro totals summary card */}
          <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-2.5 shadow-inner">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] font-black text-zinc-550 uppercase tracking-wider font-mono">
                Total Intake Summary
              </span>
              <span className="text-xl font-bold font-mono text-white">
                {totalCalories} <span className="text-xs text-zinc-500 font-mono">kcal</span>
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-zinc-450 font-mono">
              <span>Protein: <strong className="text-zinc-200 font-semibold">{totalProtein}g</strong></span>
              <span>Carbs: <strong className="text-zinc-200 font-semibold">{totalCarbs}g</strong></span>
              <span>Fat: <strong className="text-zinc-200 font-semibold">{totalFats}g</strong></span>
            </div>
          </div>

          {/* List of items */}
          <div className="space-y-2">
            {items.map((item) => {
              const isDeleteConfirming = deleteConfirmId === item.id;

              return (
                <div
                  key={item.id}
                  className="flex flex-col p-3 rounded-xl border border-zinc-900 bg-zinc-950/40 hover:bg-zinc-950/80 hover:border-zinc-800 transition-all duration-150 gap-2 relative overflow-hidden group"
                >
                  {isDeleteConfirming ? (
                    <div className="flex flex-col gap-2 p-1 text-center justify-center items-center w-full animate-fade-in">
                      <p className="text-[11px] text-zinc-350 font-medium flex items-center gap-1.5 justify-center">
                        <AlertTriangle className="w-3.5 h-3.5 text-zinc-400" />
                        Delete "{item.name}"?
                      </p>
                      <div className="flex gap-2 text-[10px]">
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1.5 rounded-lg border border-zinc-850 text-zinc-400 hover:text-white transition-all duration-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            onDeleteEntry(item.id);
                            setDeleteConfirmId(null);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#FF7E67] text-white font-bold hover:bg-[#ff6950] transition-all duration-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-zinc-200 truncate capitalize max-w-[140px]" title={item.name}>
                          {item.name}
                        </p>
                        <p className="text-[10px] text-zinc-450 font-bold truncate mt-1">
                          {item.quantity} {item.unit}
                        </p>
                        <p className="text-[9px] text-zinc-550 mt-1.5 font-bold font-mono">
                          P: {item.protein}g • C: {item.carbs}g • F: {item.fats}g
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-white bg-zinc-950 border border-zinc-900 px-2 py-0.5 rounded font-mono">
                          +{item.calories} kcal
                        </span>

                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-zinc-900 rounded-lg transition-colors duration-150 opacity-0 group-hover:opacity-100"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
