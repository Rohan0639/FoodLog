import React, { useState, useEffect } from 'react';
import type { FoodEntry } from '../types';
import { UNIT_CATEGORIES, scaleMacrosByQuantity } from '../utils/unitConverter';
import { X, Loader2, AlertCircle } from 'lucide-react';

interface EditFoodModalProps {
  entry: FoodEntry;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedEntry: FoodEntry) => Promise<void>;
}

export const EditFoodModal: React.FC<EditFoodModalProps> = ({
  entry,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(entry.name);
  const [quantity, setQuantity] = useState<number>(entry.quantity);
  const [unit, setUnit] = useState(entry.unit || 'g');

  const [calories, setCalories] = useState(entry.calories);
  const [protein, setProtein] = useState(entry.protein);
  const [carbs, setCarbs] = useState(entry.carbs);
  const [fats, setFats] = useState(entry.fats);
  const [sugar, setSugar] = useState(entry.sugar || 0);
  const [fiber, setFiber] = useState(entry.fiber || 0);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recalculate macros dynamically when quantity or unit changes
  useEffect(() => {
    if (quantity <= 0 || isNaN(quantity)) {
      return;
    }

    try {
      const scaled = scaleMacrosByQuantity(
        entry,
        quantity,
        unit || 'g',
        entry.quantity,
        entry.unit || 'g',
        entry.name,
      );
      setCalories(scaled.calories);
      setProtein(scaled.protein);
      setCarbs(scaled.carbs);
      setFats(scaled.fats);
      setSugar(scaled.sugar);
      setFiber(scaled.fiber);
      setError(null);
    } catch (err) {
      console.error('Recalculation error:', err);
      setError('Invalid unit conversion.');
    }
  }, [quantity, unit, entry]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Food name cannot be empty.');
      return;
    }
    if (quantity <= 0 || isNaN(quantity)) {
      setError('Quantity must be a positive number.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        ...entry,
        name,
        quantity,
        unit,
        calories,
        protein,
        carbs,
        fats,
        sugar,
        fiber,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const macroTiles: { label: string; value: string }[] = [
    { label: 'Calories', value: `${calories}` },
    { label: 'Protein', value: `${protein}g` },
    { label: 'Carbs', value: `${carbs}g` },
    { label: 'Fat', value: `${fats}g` },
    { label: 'Sugar', value: `${sugar}g` },
    { label: 'Fiber', value: `${fiber}g` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-soft-lg flex flex-col overflow-hidden animate-pop-in">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="font-bold text-sm text-white tracking-tight">
            Edit food entry
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-white transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-xs bg-zinc-950 border border-zinc-700 text-zinc-300 p-3 rounded-2xl font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Food Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 pl-1">
              Food name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-500 focus:ring-4 focus:ring-white/5 rounded-2xl text-xs text-white placeholder-zinc-600 focus:outline-none transition-all duration-200"
              placeholder="e.g., Banana, Boiled Egg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 pl-1">
                Quantity
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-500 focus:ring-4 focus:ring-white/5 rounded-2xl text-xs text-white num focus:outline-none transition-all duration-200"
              />
            </div>

            {/* Unit */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 pl-1">
                Unit
              </label>
              <select
                value={unit || 'g'}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-500 focus:ring-4 focus:ring-white/5 rounded-2xl text-xs text-white focus:outline-none transition-all duration-200 select-arrow"
              >
                {unit && !Object.values(UNIT_CATEGORIES).flat().includes(unit) && (
                  <option value={unit}>{unit}</option>
                )}
                <optgroup label="Count" className="bg-zinc-950">
                  {UNIT_CATEGORIES.count.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Weight" className="bg-zinc-950">
                  {UNIT_CATEGORIES.weight.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Volume" className="bg-zinc-950">
                  {UNIT_CATEGORIES.volume.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Recalculated Macros Preview */}
          <div className="p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-2.5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Live recalculation
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              {macroTiles.map((tile) => (
                <div key={tile.label} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <span className="block text-xs font-bold text-white num">{tile.value}</span>
                  <span className="text-[8.5px] text-zinc-500 uppercase tracking-wider font-semibold">{tile.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-2 text-xs font-semibold">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold transition-all duration-200 flex items-center gap-1.5 shadow-white-sm disabled:opacity-60"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
