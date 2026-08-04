import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { FoodEntry } from '../types';
import { UNIT_CATEGORIES, scaleMacrosByQuantity } from '../utils/unitConverter';
import { X, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { Button, IconButton, Modal } from '../ui/primitives';
import { spring, stagger, listItem } from '../ui/motion';

interface EditFoodModalProps {
  entry: FoodEntry;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedEntry: FoodEntry) => Promise<void>;
}

const MACRO_TILES = [
  { key: 'calories', label: 'Calories', color: '#FFFFFF', suffix: '' },
  { key: 'protein', label: 'Protein', color: '#FFFFFF', suffix: 'g' },
  { key: 'carbs', label: 'Carbs', color: '#DCDCE0', suffix: 'g' },
  { key: 'fats', label: 'Fat', color: '#B8B8C0', suffix: 'g' },
  { key: 'sugar', label: 'Sugar', color: '#9A9AA3', suffix: 'g' },
  { key: 'fiber', label: 'Fiber', color: '#7E7E88', suffix: 'g' },
] as const;

export const EditFoodModal: React.FC<EditFoodModalProps> = ({
  entry,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(entry.name);
  const [quantity, setQuantity] = useState<number>(entry.quantity);
  const [unit, setUnit] = useState(entry.unit || 'g');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Macros are DERIVED from the quantity and unit, not stored alongside them.
   *
   * They were previously six pieces of state written by an effect, which meant
   * every keystroke rendered twice and the displayed numbers lagged the input
   * by a frame. Computing them during render removes both problems and makes
   * an inconsistent state unrepresentable.
   */
  const { macros, conversionError } = useMemo(() => {
    if (quantity <= 0 || isNaN(quantity)) {
      // Keep the last valid figures on screen while the field is empty or
      // mid-edit, rather than flashing zeros.
      return {
        macros: {
          calories: entry.calories, protein: entry.protein, carbs: entry.carbs,
          fats: entry.fats, sugar: entry.sugar || 0, fiber: entry.fiber || 0,
        },
        conversionError: null as string | null,
      };
    }

    try {
      return {
        macros: scaleMacrosByQuantity(
          entry,
          quantity,
          unit || 'g',
          entry.quantity,
          entry.unit || 'g',
          entry.name,
        ),
        conversionError: null as string | null,
      };
    } catch (err) {
      console.error('Recalculation error:', err);
      return {
        macros: {
          calories: entry.calories, protein: entry.protein, carbs: entry.carbs,
          fats: entry.fats, sugar: entry.sugar || 0, fiber: entry.fiber || 0,
        },
        conversionError: 'Invalid unit conversion.',
      };
    }
  }, [entry, quantity, unit]);

  const { calories, protein, carbs, fats, sugar, fiber } = macros;

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const values: Record<string, number> = { calories, protein, carbs, fats, sugar, fiber };
  // A save failure takes precedence over a live conversion warning.
  const visibleError = error ?? conversionError;

  return (
    <Modal open={isOpen} onClose={onClose} labelledBy="edit-food-title">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 sm:pt-6 pb-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl grad-tile shadow-soft flex items-center justify-center shrink-0">
            <Pencil className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 id="edit-food-title" className="text-base font-extrabold text-fg-strong leading-tight truncate">
              Edit entry
            </h2>
            <p className="text-xs text-fg-dim font-bold truncate capitalize">{entry.name}</p>
          </div>
        </div>
        <IconButton label="Close" tone="plain" onClick={onClose}>
          <X className="w-5 h-5" />
        </IconButton>
      </div>

      <form onSubmit={handleSave} className="px-5 pb-5 space-y-3.5 overflow-y-auto">
        {visibleError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-xs bg-white/[0.06] border-2 border-white/10
                       text-accent p-3 rounded-2xl font-bold"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{visibleError}</span>
          </motion.div>
        )}

        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor="food-name" className="text-xs font-extrabold text-fg-muted pl-1">
            Food name
          </label>
          <input
            id="food-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field text-sm"
            placeholder="e.g. Banana, Boiled egg"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="food-qty" className="text-xs font-extrabold text-fg-muted pl-1">
              Quantity
            </label>
            <input
              id="food-qty"
              type="number"
              step="any"
              min="0.001"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              className="field text-sm num"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="food-unit" className="text-xs font-extrabold text-fg-muted pl-1">
              Unit
            </label>
            <select
              id="food-unit"
              value={unit || 'g'}
              onChange={(e) => setUnit(e.target.value)}
              className="field text-sm select-arrow cursor-pointer"
            >
              {unit && !Object.values(UNIT_CATEGORIES).flat().includes(unit) && (
                <option value={unit}>{unit}</option>
              )}
              <optgroup label="Count">
                {UNIT_CATEGORIES.count.map((u) => <option key={u} value={u}>{u}</option>)}
              </optgroup>
              <optgroup label="Weight">
                {UNIT_CATEGORIES.weight.map((u) => <option key={u} value={u}>{u}</option>)}
              </optgroup>
              <optgroup label="Volume">
                {UNIT_CATEGORIES.volume.map((u) => <option key={u} value={u}>{u}</option>)}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Live recalculation */}
        <div className="card-inset p-3.5 space-y-2.5">
          <span className="text-[10px] font-extrabold text-fg-dim uppercase tracking-wide">
            Live recalculation
          </span>
          <motion.div
            variants={stagger(0.035)}
            initial="hidden"
            animate="show"
            className="grid grid-cols-3 gap-2"
          >
            {MACRO_TILES.map((tile) => (
              <motion.div
                key={tile.key}
                variants={listItem}
                className="p-2 bg-surface-card rounded-xl text-center shadow-soft"
              >
                <motion.span
                  key={values[tile.key]}
                  initial={{ scale: 1.16, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={spring}
                  className="block text-sm font-extrabold num"
                  style={{ color: tile.color }}
                >
                  {values[tile.key]}{tile.suffix}
                </motion.span>
                <span className="text-[8.5px] text-fg-dim uppercase tracking-wide font-extrabold">
                  {tile.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Actions */}
        <div
          className="flex gap-2.5 pt-1"
          style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
        >
          <Button type="button" variant="soft" size="md" fullWidth onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" fullWidth disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
