import React from 'react';
import type { FoodEntry } from '../types';
import { scaleMacrosByQuantity } from '../utils/unitConverter';
import { Check, X } from 'lucide-react';

interface ReviewConfirmTableProps {
  foods: FoodEntry[];
  setFoods: React.Dispatch<React.SetStateAction<FoodEntry[]>>;
  onConfirm: () => void;
  onDiscard: () => void;
  disabled?: boolean;
}

export const ReviewConfirmTable: React.FC<ReviewConfirmTableProps> = ({
  foods,
  setFoods,
  onConfirm,
  onDiscard,
  disabled = false,
}) => {
  const handleQtyChange = (id: string, value: string) => {
    const numericValue = parseFloat(value);
    setFoods((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: isNaN(numericValue) ? 0 : numericValue }
          : item
      )
    );
  };

  const handleUnitChange = (id: string, newUnit: string) => {
    setFoods((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unit: newUnit } : item))
    );
  };

  const handleDeleteRow = (id: string) => {
    setFoods((prev) => prev.filter((item) => item.id !== id));
  };

  // Helper to compute scaled macros for a single row
  const getScaledMacros = (item: FoodEntry) => {
    const quantity = item.quantity;
    if (quantity <= 0 || isNaN(quantity)) {
      return { calories: 0, protein: 0, carbs: 0, fats: 0, sugar: 0, fiber: 0 };
    }
    try {
      const baseUnit = item.baseUnit || item.unit || 'g';
      const baseQty = item.baseQuantity || item.quantity;
      return scaleMacrosByQuantity(item, quantity, item.unit || 'g', baseQty, baseUnit, item.name);
    } catch (err) {
      console.error('Unit conversion failed:', err);
      return {
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
        sugar: item.sugar || 0,
        fiber: item.fiber || 0,
      };
    }
  };

  // Compute total calories & macros for confirmed summary
  const totals = foods.reduce(
    (acc, item) => {
      const scaled = getScaledMacros(item);
      return {
        calories: acc.calories + scaled.calories,
        protein: acc.protein + scaled.protein,
        carbs: acc.carbs + scaled.carbs,
        fats: acc.fats + scaled.fats,
        sugar: acc.sugar + scaled.sugar,
        fiber: acc.fiber + scaled.fiber,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0, sugar: 0, fiber: 0 }
  );

  return (
    <div className="w-full mt-2 rounded-2xl bg-zinc-950 border border-zinc-800 p-2.5 sm:p-4 space-y-3 sm:space-y-4 shadow-xl animate-fade-in text-white font-sans max-w-lg">
      {/* Title Header */}
      <div className="pb-2.5 border-b border-zinc-900 flex flex-col gap-1">
        <span className="text-xs font-black tracking-widest text-[#FF7E67] uppercase font-sans">
          REVIEW ESTIMATES
        </span>
      </div>

      {foods.length === 0 ? (
        <div className="py-8 text-center text-zinc-500 text-xs">
          No food items to log. Add some foods or discard.
        </div>
      ) : (
        <>
          {/* Mobile Card List View */}
          <div className="block sm:hidden space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {foods.map((food) => {
              const scaled = getScaledMacros(food);
              return (
                <div key={food.id} className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-2 relative">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-zinc-200 capitalize truncate pr-6 text-xs" title={food.name}>
                      {food.name}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleDeleteRow(food.id)}
                      className="absolute top-2.5 right-2.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-900/50 p-1 rounded-md transition-all duration-150"
                      title="Delete item"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        disabled={disabled}
                        value={food.quantity === 0 ? '' : food.quantity}
                        onChange={(e) => handleQtyChange(food.id, e.target.value)}
                        className="w-11 px-1 py-0.5 text-center bg-zinc-900/60 border border-zinc-800 rounded-lg text-white font-mono focus:outline-none focus:border-zinc-500 disabled:opacity-55 disabled:cursor-not-allowed text-[11px]"
                        placeholder="0"
                      />
                      <select
                        value={food.unit || 'g'}
                        disabled={disabled}
                        onChange={(e) => handleUnitChange(food.id, e.target.value)}
                        className="px-1 py-0.5 bg-zinc-900/60 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-500 disabled:opacity-55 disabled:cursor-not-allowed text-[11px] cursor-pointer select-arrow pr-3.5"
                      >
                        {food.unit && !['g', 'ml', 'piece', 'cup'].includes(food.unit) && (
                          <option value={food.unit}>{food.unit}</option>
                        )}
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                        <option value="piece">piece</option>
                        <option value="cup">cup</option>
                      </select>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-white font-bold text-[11px]">{scaled.calories} kcal</div>
                      <div className="text-[8.5px] text-zinc-400 mt-0.5">
                        P:{scaled.protein}g | C:{scaled.carbs}g | F:{scaled.fats}g | S:{scaled.sugar}g | Fib:{scaled.fiber}g
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop/Tablet Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 font-semibold">Food Item</th>
                  <th className="pb-2 font-semibold pl-2 sm:pl-4">Qty</th>
                  <th className="pb-2 text-right font-semibold">Nutrition Info</th>
                  <th className="pb-2 text-right w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 text-xs">
                {foods.map((food) => {
                  const scaled = getScaledMacros(food);
                  return (
                    <tr key={food.id} className="hover:bg-zinc-900/20 transition-colors">
                      {/* Food Name */}
                      <td className="py-2.5 sm:py-3 pr-1 sm:pr-2 font-medium capitalize max-w-[90px] min-[370px]:max-w-[120px] truncate" title={food.name}>
                        {food.name}
                      </td>

                      {/* Qty Editable Input + Unit Selector */}
                      <td className="py-2.5 sm:py-3 pl-2 sm:pl-4">
                        <div className="flex items-center gap-1 sm:gap-1.5">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            disabled={disabled}
                            value={food.quantity === 0 ? '' : food.quantity}
                            onChange={(e) => handleQtyChange(food.id, e.target.value)}
                            className="w-11 min-[370px]:w-14 px-1 sm:px-1.5 py-1 text-center bg-zinc-900/60 border border-zinc-800 rounded-lg text-white font-mono focus:outline-none focus:border-zinc-500 disabled:opacity-55 disabled:cursor-not-allowed text-[11px] sm:text-xs"
                            placeholder="0"
                          />
                          <select
                            value={food.unit || 'g'}
                            disabled={disabled}
                            onChange={(e) => handleUnitChange(food.id, e.target.value)}
                            className="px-1 sm:px-1.5 py-1 bg-zinc-900/60 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-500 disabled:opacity-55 disabled:cursor-not-allowed text-[11px] sm:text-xs cursor-pointer select-arrow pr-3 min-[370px]:pr-4"
                          >
                            {food.unit && !['g', 'ml', 'piece', 'cup'].includes(food.unit) && (
                              <option value={food.unit}>{food.unit}</option>
                            )}
                            <option value="g">g</option>
                            <option value="ml">ml</option>
                            <option value="piece">piece</option>
                            <option value="cup">cup</option>
                          </select>
                        </div>
                      </td>

                      {/* Dynamic Nutrition calculations */}
                      <td className="py-2.5 sm:py-3 text-right font-mono">
                        <div className="text-white font-bold text-[11px] sm:text-xs">{scaled.calories} kcal</div>
                        <div className="text-[8px] sm:text-[9px] text-zinc-400 mt-0.5">
                          P:{scaled.protein}g | C:{scaled.carbs}g | F:{scaled.fats}g | S:{scaled.sugar}g | Fib:{scaled.fiber}g
                        </div>
                      </td>

                      {/* Row Delete Button */}
                      <td className="py-2.5 sm:py-3 text-right pl-1.5 sm:pl-2">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleDeleteRow(food.id)}
                          className="text-zinc-500 hover:text-red-400 hover:bg-zinc-900/50 p-1 rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                          title="Delete item"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Dynamic Summary Row */}
      {foods.length > 0 && (
        <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-900 space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold text-zinc-300">
            <span>Total Estimated Intake</span>
            <span className="font-mono text-white text-sm">{totals.calories} kcal</span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-[10px] text-zinc-400 font-mono pl-0">
            <span>Protein: <strong className="text-zinc-300 font-semibold">{Math.round(totals.protein * 10) / 10}g</strong></span>
            <span>Carbs: <strong className="text-zinc-300 font-semibold">{Math.round(totals.carbs * 10) / 10}g</strong></span>
            <span>Fat: <strong className="text-zinc-300 font-semibold">{Math.round(totals.fats * 10) / 10}g</strong></span>
            <span>Sugar: <strong className="text-zinc-300 font-semibold">{Math.round(totals.sugar * 10) / 10}g</strong></span>
            <span>Fiber: <strong className="text-zinc-300 font-semibold">{Math.round(totals.fiber * 10) / 10}g</strong></span>
          </div>
        </div>
      )}

      {/* Confirm & Discard CTA Buttons */}
      <div className="flex gap-2 sm:gap-3 pt-1 text-[10px] sm:text-[11px] font-bold">
        <button
          type="button"
          disabled={disabled || foods.length === 0}
          onClick={onConfirm}
          className="flex-1 px-2.5 py-2.5 rounded-xl bg-[#FF7E67] hover:bg-[#ff6950] text-white flex items-center justify-center gap-1 sm:gap-1.5 shadow-md active:scale-98 transition-all disabled:opacity-45 disabled:cursor-not-allowed touch-manipulation"
        >
          <Check className="w-4 h-4 shrink-0" />
          <span>CONFIRM & LOG</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onDiscard}
          className="flex-1 px-2.5 py-2.5 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-transparent text-white flex items-center justify-center gap-1 sm:gap-1.5 active:scale-98 transition-all disabled:opacity-45 disabled:cursor-not-allowed touch-manipulation"
        >
          <X className="w-4 h-4 shrink-0" />
          <span>DISCARD</span>
        </button>
      </div>
    </div>
  );
};
