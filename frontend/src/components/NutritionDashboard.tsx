import React from 'react';
import type { FoodItem, DailyGoal } from '../types';
import { Flame, Trash2, Calendar, Target, RefreshCw, BarChart2 } from 'lucide-react';

interface NutritionDashboardProps {
  foods: FoodItem[];
  dailyGoal: DailyGoal;
  onRemoveFood: (id: string) => void;
  onClearAll: () => void;
}

export const NutritionDashboard: React.FC<NutritionDashboardProps> = ({
  foods,
  dailyGoal,
  onRemoveFood,
  onClearAll,
}) => {
  // Compute totals
  const totalCalories = foods.reduce((acc, curr) => acc + curr.calories, 0);
  const totalProtein = Math.round(foods.reduce((acc, curr) => acc + curr.protein, 0) * 10) / 10;
  const totalCarbs = Math.round(foods.reduce((acc, curr) => acc + curr.carbs, 0) * 10) / 10;
  const totalFat = Math.round(foods.reduce((acc, curr) => acc + curr.fat, 0) * 10) / 10;

  // Compute percentages
  const calPercent = Math.min(Math.round((totalCalories / dailyGoal.calories) * 105) / 105, 1);
  const proPercent = Math.min(Math.round((totalProtein / dailyGoal.protein) * 105) / 105, 1);
  const carbPercent = Math.min(Math.round((totalCarbs / dailyGoal.carbs) * 105) / 105, 1);
  const fatPercent = Math.min(Math.round((totalFat / dailyGoal.fat) * 105) / 105, 1);

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 border-l border-slate-900 overflow-hidden font-sans">
      {/* Dashboard Header */}
      <div className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-950/80 sticky top-0 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
            <BarChart2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white leading-tight">Logged Tracker</h3>
            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono uppercase">
              <Calendar className="w-3 h-3" />
              Today
            </p>
          </div>
        </div>

        {foods.length > 0 && (
          <button
            onClick={onClearAll}
            title="Clear all logged items"
            className="text-xs text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 px-2.5 py-1.5 rounded-lg border border-slate-900 hover:border-rose-500/10 transition-all duration-200 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* Calorie Stats Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-850 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500/10" />
              Calories Logged
            </span>
            <div className="text-right">
              <span className="text-2xl font-bold text-white font-mono">{totalCalories}</span>
              <span className="text-xs text-slate-500 font-mono"> / {dailyGoal.calories} kcal</span>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-slate-800/80 rounded-full overflow-hidden mb-1">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 rounded-full"
              style={{ width: `${calPercent * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-semibold font-mono">
            <span>{Math.round(calPercent * 100)}%</span>
            <span>{Math.max(0, dailyGoal.calories - totalCalories)} kcal left</span>
          </div>
        </div>

        {/* Macro Progress Bars */}
        <div className="space-y-3.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            Macronutrients
          </span>
          
          <div className="space-y-3 bg-slate-900/40 border border-slate-900 rounded-2xl p-4">
            {/* Protein */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  Protein
                </span>
                <span className="text-slate-400 font-mono">
                  <strong className="text-slate-200">{totalProtein}g</strong> / {dailyGoal.protein}g
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500 rounded-full"
                  style={{ width: `${proPercent * 100}%` }}
                />
              </div>
            </div>

            {/* Carbs */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Carbs
                </span>
                <span className="text-slate-400 font-mono">
                  <strong className="text-slate-200">{totalCarbs}g</strong> / {dailyGoal.carbs}g
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-500 rounded-full"
                  style={{ width: `${carbPercent * 100}%` }}
                />
              </div>
            </div>

            {/* Fat */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-450" />
                  Fat
                </span>
                <span className="text-slate-400 font-mono">
                  <strong className="text-slate-200">{totalFat}g</strong> / {dailyGoal.fat}g
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-500 rounded-full"
                  style={{ width: `${fatPercent * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Log History */}
        <div className="space-y-2.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            Logged Meals
          </span>
          
          {foods.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-850 rounded-2xl text-center">
              <Target className="w-6 h-6 text-slate-600 mb-2" />
              <p className="text-xs text-slate-400 font-medium">Nothing logged yet</p>
              <p className="text-[10px] text-slate-500 mt-1 max-w-[150px]">
                Chat items will automatically be cataloged here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {foods.map((food) => (
                <div
                  key={food.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-900 bg-slate-900/30 hover:border-slate-850 hover:bg-slate-900/50 group transition-all duration-150"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      {food.name}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                      {food.quantity} {food.unit} • P: {food.protein}g C: {food.carbs}g F: {food.fat}g
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-slate-300 bg-slate-900 border border-slate-800/80 px-2 py-0.5 rounded font-mono">
                      +{food.calories}
                    </span>
                    <button
                      onClick={() => onRemoveFood(food.id)}
                      className="p-1 text-slate-650 hover:text-rose-450 hover:bg-rose-500/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150"
                      title="Remove food item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
