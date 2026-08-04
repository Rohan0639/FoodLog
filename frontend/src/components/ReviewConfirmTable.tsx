import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FoodEntry } from '../types';
import { scaleMacrosByQuantity } from '../utils/unitConverter';
import { Check, X, Minus, Plus, ClipboardList, BookMarked } from 'lucide-react';
import {Button, CountUp} from '../ui/primitives';
import { cx } from '../ui/cx';
import { listItem, spring, stagger } from '../ui/motion';

interface ReviewConfirmTableProps {
  foods: FoodEntry[];
  setFoods: React.Dispatch<React.SetStateAction<FoodEntry[]>>;
  onConfirm: () => void;
  onDiscard: () => void;
  disabled?: boolean;
}

const UNITS = ['g', 'ml', 'piece', 'cup'];

const MACRO_KEYS: { key: 'protein' | 'carbs' | 'fats' | 'sugar' | 'fiber'; label: string; color: string }[] = [
  { key: 'protein', label: 'Protein', color: '#FFFFFF' },
  { key: 'carbs', label: 'Carbs', color: '#DCDCE0' },
  { key: 'fats', label: 'Fat', color: '#B8B8C0' },
  { key: 'sugar', label: 'Sugar', color: '#9A9AA3' },
  { key: 'fiber', label: 'Fiber', color: '#7E7E88' },
];

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

  /** Stepper: a sensible increment for the unit, never going below zero. */
  const stepQty = (id: string, direction: 1 | -1) => {
    setFoods((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const unit = (item.unit || '').toLowerCase();
        const step = unit === 'g' || unit === 'ml' ? 10 : 1;
        const next = Math.round((item.quantity + direction * step) * 100) / 100;
        return { ...item, quantity: Math.max(0, next) };
      })
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
    <motion.div
      layout
      variants={stagger(0.05)}
      initial="hidden"
      animate="show"
      className="w-full mt-1.5 rounded-3xl bg-surface-card p-3.5 sm:p-4 space-y-3 shadow-float border-2 border-white/10 max-w-lg"
    >
      {/* Header */}
      <motion.div variants={listItem} className="flex items-center gap-2 pb-2.5 border-b-2 border-surface-inset">
        <div className="w-8 h-8 rounded-xl bg-white/10 text-accent flex items-center justify-center shrink-0">
          <ClipboardList className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="block text-sm font-extrabold text-fg-strong leading-tight">Check this over</span>
          <span className="block text-[11px] font-bold text-fg-dim">Adjust amounts before logging</span>
        </div>
      </motion.div>

      {foods.length === 0 ? (
        <div className="py-8 text-center text-fg-dim text-xs font-bold">
          Nothing left to log. Add some foods or discard.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-0.5">
          <AnimatePresence initial={false} mode="popLayout">
            {foods.map((food) => {
              const scaled = getScaledMacros(food);
              return (
                <motion.div
                  key={food.id}
                  layout
                  variants={listItem}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="card-inset p-3 space-y-2.5 relative"
                >
                  {/* Name + remove */}
                  <div className="flex justify-between items-start gap-2">
                    <span className="min-w-0 pr-1">
                      <span
                        className="font-extrabold text-fg-strong capitalize text-sm leading-snug break-words"
                        title={food.name}
                      >
                        {food.name}
                      </span>
                      {/* Where this row came from. A guess is labelled as one so
                          the user knows which rows deserve a second look. */}
                      {food.source === 'dictionary' && (
                        <span
                          className={cx(
                            'chip ml-1.5 px-1.5 py-0.5 text-[9px] align-middle',
                            food.matchStage === 'fuzzy'
                              ? 'bg-white/10 text-fg-muted'
                              : 'bg-white/[0.07] text-fg-dim'
                          )}
                          title={
                            food.matchStage === 'fuzzy'
                              ? `Best guess from your foods (${Math.round((food.matchConfidence ?? 0) * 100)}% match) — check this one`
                              : 'Matched a food you have logged before'
                          }
                        >
                          <BookMarked className="w-2.5 h-2.5" />
                          {food.matchStage === 'fuzzy' ? 'guess' : 'your foods'}
                        </span>
                      )}
                    </span>
                    <motion.button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleDeleteRow(food.id)}
                      whileHover={{ scale: 1.15, rotate: 90 }}
                      whileTap={{ scale: 0.85 }}
                      transition={spring}
                      className="text-fg-dim hover:text-accent shrink-0 p-1 -m-1 rounded-full
                                 disabled:opacity-40 touch-manipulation"
                      aria-label={`Remove ${food.name}`}
                    >
                      <X className="w-4 h-4" strokeWidth={2.6} />
                    </motion.button>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Quantity stepper */}
                    <div className="flex items-center gap-1.5">
                      <motion.button
                        type="button"
                        disabled={disabled}
                        onClick={() => stepQty(food.id, -1)}
                        whileTap={{ scale: 0.85 }}
                        className="w-7 h-7 rounded-full bg-surface-card border-2 border-surface-line text-fg-muted
                                   hover:border-white/[0.14] hover:text-accent flex items-center justify-center
                                   shrink-0 disabled:opacity-40 touch-manipulation"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" strokeWidth={3} />
                      </motion.button>

                      <input
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        disabled={disabled}
                        value={food.quantity === 0 ? '' : food.quantity}
                        onChange={(e) => handleQtyChange(food.id, e.target.value)}
                        className="field-sm w-14 text-center num disabled:opacity-55"
                        placeholder="0"
                        aria-label={`Quantity of ${food.name}`}
                      />

                      <motion.button
                        type="button"
                        disabled={disabled}
                        onClick={() => stepQty(food.id, 1)}
                        whileTap={{ scale: 0.85 }}
                        className="w-7 h-7 rounded-full bg-surface-card border-2 border-surface-line text-fg-muted
                                   hover:border-white/[0.14] hover:text-accent flex items-center justify-center
                                   shrink-0 disabled:opacity-40 touch-manipulation"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                      </motion.button>

                      <select
                        value={food.unit || 'g'}
                        disabled={disabled}
                        onChange={(e) => handleUnitChange(food.id, e.target.value)}
                        className="field-sm select-arrow cursor-pointer disabled:opacity-55 text-xs"
                        aria-label={`Unit for ${food.name}`}
                      >
                        {food.unit && !UNITS.includes(food.unit) && (
                          <option value={food.unit}>{food.unit}</option>
                        )}
                        {UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>

                    {/* Live calories */}
                    <motion.span
                      key={scaled.calories}
                      initial={{ scale: 1.14 }}
                      animate={{ scale: 1 }}
                      transition={spring}
                      className="chip grad-accent px-3 py-1.5 text-xs shadow-glow num shrink-0"
                    >
                      {scaled.calories} kcal
                    </motion.span>
                  </div>

                  {/* Macro chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {MACRO_KEYS.map((macro) => (
                      <span
                        key={macro.key}
                        className="chip px-2 py-0.5 text-[10px]"
                        style={{ backgroundColor: `${macro.color}1A`, color: macro.color }}
                      >
                        {macro.label} {scaled[macro.key]}g
                      </span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Totals */}
      <AnimatePresence>
        {foods.length > 0 && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl grad-panel border-2 border-surface-line p-3 space-y-2"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-extrabold text-fg-base">Total</span>
              <span className="text-lg font-extrabold text-accent num">
                <CountUp value={totals.calories} suffix=" kcal" />
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MACRO_KEYS.map((macro) => (
                <span
                  key={macro.key}
                  className="chip px-2 py-0.5 text-[10px]"
                  style={{ backgroundColor: `${macro.color}1A`, color: macro.color }}
                >
                  {macro.label} {Math.round(totals[macro.key] * 10) / 10}g
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className={cx('flex gap-2 pt-0.5')}>
        <Button
          variant="primary"
          size="md"
          fullWidth
          disabled={disabled || foods.length === 0}
          onClick={onConfirm}
        >
          <Check className="w-4 h-4 shrink-0" strokeWidth={3} />
          Log it!
        </Button>
        <Button variant="soft" size="md" disabled={disabled} onClick={onDiscard} className="shrink-0">
          <X className="w-4 h-4 shrink-0" strokeWidth={3} />
          Discard
        </Button>
      </div>
    </motion.div>
  );
};
