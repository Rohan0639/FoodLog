import React, { useState, useEffect } from 'react';
import type { FoodEntry } from '../types';
import { convertUnit, UNIT_CATEGORIES } from '../utils/unitConverter';
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
      // Convert new quantity in new unit back to original base unit
      const scaledQuantity = convertUnit(quantity, unit || 'g', entry.unit || 'g', entry.name);
      
      // Calculate scale factor relative to the base entry values
      const scale = scaledQuantity / entry.quantity;

      setCalories(Math.max(0, Math.round(entry.calories * scale)));
      setProtein(Math.max(0, Math.round(entry.protein * scale * 10) / 10));
      setCarbs(Math.max(0, Math.round(entry.carbs * scale * 10) / 10));
      setFats(Math.max(0, Math.round(entry.fats * scale * 10) / 10));
      setSugar(Math.max(0, Math.round((entry.sugar || 0) * scale * 10) / 10));
      setFiber(Math.max(0, Math.round((entry.fiber || 0) * scale * 10) / 10));
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-4 border-b border-zinc-900 flex justify-between items-center bg-black/50">
          <h3 className="font-bold text-sm text-white uppercase tracking-wider">
            Edit Food Entry
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-xs bg-red-950/30 border border-red-900/50 text-red-400 p-3 rounded-xl font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Food Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Food Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-black border border-zinc-800 focus:border-white rounded-xl text-xs text-white placeholder-zinc-700 focus:outline-none transition-all duration-200"
              placeholder="e.g., Banana, Boiled Egg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Quantity
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-black border border-zinc-800 focus:border-white rounded-xl text-xs text-white focus:outline-none transition-all duration-200"
              />
            </div>

            {/* Unit */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Unit
              </label>
              <select
                value={unit || 'g'}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-zinc-800 focus:border-white rounded-xl text-xs text-white focus:outline-none transition-all duration-200 select-arrow"
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
          <div className="p-3 bg-black rounded-xl border border-zinc-900 space-y-2">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
              Live Nutrient Recalculation
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-lg">
                <span className="block text-[10px] font-bold text-white font-mono">{calories}</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Calories</span>
              </div>
              <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-lg">
                <span className="block text-[10px] font-bold text-white font-mono">{protein}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Protein</span>
              </div>
              <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-lg">
                <span className="block text-[10px] font-bold text-white font-mono">{carbs}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Carbs</span>
              </div>
              <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-lg">
                <span className="block text-[10px] font-bold text-white font-mono">{fats}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Fat</span>
              </div>
              <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-lg">
                <span className="block text-[10px] font-bold text-white font-mono">{sugar}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Sugar</span>
              </div>
              <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-lg">
                <span className="block text-[10px] font-bold text-white font-mono">{fiber}g</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider">Fiber</span>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-2 text-[10px]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-2 rounded-xl border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-3.5 py-2 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-all duration-200 flex items-center gap-1.5 shadow"
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
