import React, { useState } from 'react';
import type { FoodEntry, DailyGoal } from '../types';
import { EditFoodModal } from './EditFoodModal';
import { Flame, Trash2, Edit2, Calendar, Target, RefreshCw, BarChart2, AlertTriangle } from 'lucide-react';

interface NutritionDashboardProps {
  logs: FoodEntry[];
  dailyGoal: DailyGoal;
  onDeleteFoodLog: (id: string) => void;
  onUpdateFoodLog: (updatedEntry: FoodEntry) => Promise<void>;
  onClearAll: () => void;
}

export const NutritionDashboard: React.FC<NutritionDashboardProps> = ({
  logs,
  dailyGoal,
  onDeleteFoodLog,
  onUpdateFoodLog,
  onClearAll,
}) => {
  const [activeEditEntry, setActiveEditEntry] = useState<FoodEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Compute totals from logs (individual FoodEntry items)
  const totalCalories = logs.reduce((acc, curr) => acc + (curr.calories || 0), 0);
  const totalProtein = Math.round(logs.reduce((acc, curr) => acc + (curr.protein || 0), 0) * 10) / 10;
  const totalCarbs = Math.round(logs.reduce((acc, curr) => acc + (curr.carbs || 0), 0) * 10) / 10;
  const totalFat = Math.round(logs.reduce((acc, curr) => acc + (curr.fats || 0), 0) * 10) / 10;

  // Compute percentages
  const calPercent = Math.min(Math.round((totalCalories / dailyGoal.calories) * 105) / 105, 1);
  const proPercent = Math.min(Math.round((totalProtein / dailyGoal.protein) * 105) / 105, 1);
  const carbPercent = Math.min(Math.round((totalCarbs / dailyGoal.carbs) * 105) / 105, 1);
  const fatPercent = Math.min(Math.round((totalFat / dailyGoal.fat) * 105) / 105, 1);

  return (
    <div className="w-full h-full flex flex-col bg-black text-white border-l border-zinc-900 overflow-hidden font-sans">
      {/* Dashboard Header */}
      <div className="p-4 border-b border-zinc-900 flex justify-between items-center bg-black/85 top-0 backdrop-blur-md z-10 sticky">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-zinc-900 text-white border border-zinc-850">
            <BarChart2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white leading-tight">Logged Tracker</h3>
            <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5 font-mono uppercase font-bold">
              <Calendar className="w-3 h-3" />
              Today
            </p>
          </div>
        </div>

        {logs.length > 0 && (
          <button
            onClick={onClearAll}
            title="Clear all logged items"
            className="text-xs text-zinc-450 hover:text-white hover:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-900 hover:border-zinc-800 transition-all duration-200 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* Calorie Stats Card */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-850 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5 uppercase tracking-wide">
              <Flame className="w-4 h-4 text-white" />
              Calories Logged
            </span>
            <div className="text-right">
              <span className="text-2xl font-bold text-white font-mono">{totalCalories}</span>
              <span className="text-xs text-zinc-500 font-mono"> / {dailyGoal.calories} kcal</span>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden mb-1 border border-zinc-800">
            <div
              className="h-full bg-white transition-all duration-500 rounded-full"
              style={{ width: `${calPercent * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-455 font-bold font-mono">
            <span>{Math.round(calPercent * 100)}%</span>
            <span>{Math.max(0, dailyGoal.calories - totalCalories)} kcal left</span>
          </div>
        </div>

        {/* Macro Progress Bars */}
        <div className="space-y-3.5">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
            Macronutrients
          </span>
          
          <div className="space-y-3.5 bg-zinc-950 border border-zinc-850 rounded-2xl p-4">
            {/* Protein */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  Protein
                </span>
                <span className="text-zinc-400 font-mono font-medium">
                  <strong className="text-white">{totalProtein}g</strong> / {dailyGoal.protein}g
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/60">
                <div
                  className="h-full bg-white transition-all duration-500 rounded-full"
                  style={{ width: `${proPercent * 100}%` }}
                />
              </div>
            </div>

            {/* Carbs */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-zinc-400" />
                  Carbs
                </span>
                <span className="text-zinc-400 font-mono font-medium">
                  <strong className="text-white">{totalCarbs}g</strong> / {dailyGoal.carbs}g
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/60">
                <div
                  className="h-full bg-zinc-400 transition-all duration-500 rounded-full"
                  style={{ width: `${carbPercent * 100}%` }}
                />
              </div>
            </div>

            {/* Fat */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-zinc-650" />
                  Fat
                </span>
                <span className="text-zinc-400 font-mono font-medium">
                  <strong className="text-white">{totalFat}g</strong> / {dailyGoal.fat}g
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/60">
                <div
                  className="h-full bg-zinc-650 transition-all duration-500 rounded-full"
                  style={{ width: `${fatPercent * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Log History */}
        <div className="space-y-2.5">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
            Logged Foods
          </span>
          
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-zinc-850 rounded-2xl text-center">
              <Target className="w-6 h-6 text-zinc-600 mb-2" />
              <p className="text-xs text-zinc-450 font-semibold">Nothing logged yet</p>
              <p className="text-[10px] text-zinc-550 mt-1 max-w-[150px] font-medium leading-relaxed">
                Logged food entries will list here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((item) => {
                const isDeleteConfirming = deleteConfirmId === item.id;
                
                return (
                  <div
                    key={item.id}
                    className="flex flex-col p-3 rounded-xl border border-zinc-900 bg-zinc-950 hover:border-zinc-850 hover:bg-zinc-900 group transition-all duration-150 gap-2 relative overflow-hidden"
                  >
                    {isDeleteConfirming ? (
                      <div className="flex flex-col gap-2 p-1 text-center justify-center items-center w-full animate-fade-in">
                        <p className="text-[11px] text-zinc-300 font-medium flex items-center gap-1.5 justify-center">
                          <AlertTriangle className="w-3.5 h-3.5 text-zinc-400" />
                          Delete "{item.name}"?
                        </p>
                        <div className="flex gap-2 text-[10px]">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white transition-all duration-200"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              onDeleteFoodLog(item.id);
                              setDeleteConfirmId(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white text-black font-bold hover:bg-zinc-200 transition-all duration-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-bold text-zinc-200 truncate capitalize max-w-[150px]" title={item.name}>
                              {item.name}
                            </p>
                            {item.isOffline && (
                              <span className="text-[9px] bg-zinc-900 text-zinc-400 border border-zinc-800 px-1.5 py-0.5 rounded font-mono uppercase font-bold animate-pulse">
                                Offline
                              </span>
                            )}
                            {item.isOfflineUpdated && (
                              <span className="text-[9px] bg-zinc-900 text-zinc-450 border border-zinc-800 px-1.5 py-0.5 rounded font-mono uppercase font-bold animate-pulse">
                                Sync Pending
                              </span>
                            )}
                          </div>
                          
                          <p className="text-[10px] text-zinc-450 font-bold truncate mt-1">
                            {item.quantity} {item.unit}
                          </p>

                          <p className="text-[9px] text-zinc-500 mt-1.5 font-bold font-mono">
                            P: {item.protein}g • C: {item.carbs}g • F: {item.fats}g
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-white bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded font-mono">
                            +{item.calories} kcal
                          </span>
                          
                          <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-150">
                            <button
                              onClick={() => setActiveEditEntry(item)}
                              className="p-1.5 text-zinc-550 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors duration-150"
                              title="Edit food item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(item.id)}
                              className="p-1.5 text-zinc-550 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors duration-150"
                              title="Delete food item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activeEditEntry && (
        <EditFoodModal
          entry={activeEditEntry}
          isOpen={!!activeEditEntry}
          onClose={() => setActiveEditEntry(null)}
          onSave={onUpdateFoodLog}
        />
      )}
    </div>
  );
};
