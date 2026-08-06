import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookMarked, Check, Package, Pencil, Search, Trash2, X } from 'lucide-react';
import { dictionaryService } from '../lib/services';
import type { DictionaryEntry } from '../lib/storage/schema';
import { Button, IconButton, Modal } from '../ui/primitives';
import { cx } from '../ui/cx';
import { listItem, spring, stagger } from '../ui/motion';

interface MyFoodsSheetProps {
  open: boolean;
  onClose: () => void;
}

const MACRO_FIELDS = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
] as const;

interface EditDraft {
  brand: string;
  productName: string;
  baseQuantity: number;
  baseUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
}

/** Turns a stored per-unit entry back into a per-serving form for editing. */
function toDraft(entry: DictionaryEntry): EditDraft {
  return {
    brand: entry.brand ?? '',
    productName: entry.productName ?? entry.name,
    baseQuantity: 1,
    baseUnit: entry.baseUnit,
    calories: entry.perUnit.calories,
    protein: entry.perUnit.protein,
    carbs: entry.perUnit.carbs,
    fat: entry.perUnit.fats,
    fiber: entry.perUnit.fiber,
    sugar: entry.perUnit.sugar,
  };
}

/**
 * The personal food library.
 *
 * Everything here decides what gets logged without asking the AI, so a wrong
 * figure would repeat itself indefinitely. That is the whole reason this screen
 * exists: the library has to be inspectable and correctable, not a black box.
 */
export const MyFoodsSheet: React.FC<MyFoodsSheetProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const foods = useMemo(() => dictionaryService.search(query), [query, revision]);
  const refresh = () => setRevision((n) => n + 1);

  const startEdit = (entry: DictionaryEntry) => {
    setEditingId(entry.id);
    setDraft(toDraft(entry));
    setConfirmDeleteId(null);
  };

  const setField = (key: keyof EditDraft, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (key === 'brand' || key === 'productName' || key === 'baseUnit') {
        return { ...prev, [key]: value };
      }
      const numeric = parseFloat(value);
      return { ...prev, [key]: Number.isFinite(numeric) && numeric >= 0 ? numeric : 0 };
    });
  };

  const saveEdit = () => {
    if (!editingId || !draft) return;
    dictionaryService.update(editingId, draft);
    setEditingId(null);
    setDraft(null);
    refresh();
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="my-foods-title" className="sm:max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 sm:pt-6 pb-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl grad-tile shadow-soft flex items-center justify-center shrink-0">
            <BookMarked className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 id="my-foods-title" className="text-base font-extrabold text-fg-strong leading-tight">
              My foods
            </h2>
            <p className="text-xs text-fg-dim font-bold">
              {foods.length} saved · used before asking the AI
            </p>
          </div>
        </div>
        <IconButton label="Close" tone="plain" onClick={onClose}>
          <X className="w-5 h-5" />
        </IconButton>
      </div>

      {/* Search */}
      <div className="px-5 pb-3 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-fg-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your foods…"
            aria-label="Search your foods"
            className="field text-sm pl-10"
          />
        </div>
      </div>

      {/* List */}
      <motion.div
        variants={stagger(0.03)}
        initial="hidden"
        animate="show"
        className="px-5 pb-6 space-y-2 overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {foods.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm font-extrabold text-fg-base">
              {query ? 'Nothing matches that' : 'No foods yet'}
            </p>
            <p className="text-[11px] font-bold text-fg-dim mt-1.5 leading-relaxed">
              {query
                ? 'Try a shorter search.'
                : 'Foods are added when you log a meal, or when you scan a nutrition label.'}
            </p>
          </div>
        ) : (
          foods.map((entry) => {
            const isEditing = editingId === entry.id;
            const isConfirming = confirmDeleteId === entry.id;

            return (
              <motion.div key={entry.id} variants={listItem} layout className="card p-3.5">
                <AnimatePresence mode="wait" initial={false}>
                  {isEditing && draft ? (
                    <motion.div
                      key="edit"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2.5"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={draft.brand}
                          onChange={(e) => setField('brand', e.target.value)}
                          placeholder="Brand"
                          className="field text-xs"
                        />
                        <input
                          value={draft.productName}
                          onChange={(e) => setField('productName', e.target.value)}
                          placeholder="Product"
                          className="field text-xs"
                        />
                      </div>

                      <p className="text-[10px] font-extrabold text-fg-dim uppercase tracking-wide pl-1">
                        Per 1 {draft.baseUnit}
                      </p>

                      <div className="grid grid-cols-3 gap-1.5">
                        {MACRO_FIELDS.map((field) => (
                          <label key={field.key} className="card-inset px-2 py-1.5">
                            <span className="block text-[9px] font-extrabold text-fg-dim uppercase">
                              {field.label}
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              inputMode="decimal"
                              value={draft[field.key]}
                              onChange={(e) => setField(field.key, e.target.value)}
                              className="w-full bg-transparent text-sm font-extrabold text-fg-strong num focus:outline-none"
                            />
                          </label>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-0.5">
                        <Button
                          variant="soft"
                          size="sm"
                          onClick={() => { setEditingId(null); setDraft(null); }}
                        >
                          Cancel
                        </Button>
                        <Button variant="primary" size="sm" fullWidth onClick={saveEdit}>
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          Save
                        </Button>
                      </div>
                    </motion.div>
                  ) : isConfirming ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-2 py-1"
                    >
                      <p className="text-[11px] font-extrabold text-fg-base text-center">
                        Forget “{entry.name}”?
                      </p>
                      <div className="flex gap-2 text-[11px] font-extrabold">
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3.5 py-1.5 rounded-full bg-surface-inset text-fg-muted"
                        >
                          Keep
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          onClick={() => {
                            dictionaryService.remove(entry.id);
                            setConfirmDeleteId(null);
                            refresh();
                          }}
                          className="px-3.5 py-1.5 rounded-full grad-accent shadow-glow"
                        >
                          Forget
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="row"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-3"
                    >
                      {entry.imageUrl ? (
                        <img
                          src={entry.imageUrl}
                          alt=""
                          className="w-10 h-10 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-surface-inset flex items-center justify-center shrink-0">
                          {entry.kind === 'scanned'
                            ? <Package className="w-4 h-4 text-fg-dim" />
                            : <BookMarked className="w-4 h-4 text-fg-dim" />}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-extrabold text-fg-strong capitalize">
                            {entry.productName || entry.name}
                          </span>
                          {entry.brand && (
                            <span className="chip bg-white/[0.07] text-fg-dim px-1.5 py-0.5 text-[9px] capitalize">
                              {entry.brand}
                            </span>
                          )}
                          {entry.source === 'label' && (
                            <span className="chip bg-white/10 text-fg-muted px-1.5 py-0.5 text-[9px]">
                              from label
                            </span>
                          )}
                          {entry.source === 'user' && (
                            <span className="chip bg-white/10 text-fg-muted px-1.5 py-0.5 text-[9px]">
                              edited
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-fg-dim num mt-0.5">
                          {entry.perUnit.calories} kcal / {entry.baseUnit} · P {entry.perUnit.protein}
                          {' · '}C {entry.perUnit.carbs} · F {entry.perUnit.fats}
                        </p>
                        <p className="text-[10px] font-bold text-fg-faint mt-0.5">
                          logged {entry.timesLogged}×
                        </p>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          transition={spring}
                          onClick={() => startEdit(entry)}
                          aria-label={`Edit ${entry.name}`}
                          className="p-1.5 text-fg-dim hover:text-fg-base rounded-full"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          transition={spring}
                          onClick={() => setConfirmDeleteId(entry.id)}
                          aria-label={`Delete ${entry.name}`}
                          className={cx('p-1.5 rounded-full text-fg-dim hover:text-accent')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </Modal>
  );
};
