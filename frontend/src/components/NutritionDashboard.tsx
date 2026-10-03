import React, { Suspense, lazy, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FoodEntry, DailyGoal } from '../types';
import {
  Flame, Trash2, Edit2, Target, RotateCcw, AlertTriangle, Utensils, PartyPopper,
} from 'lucide-react';
import { getLocalIsoDate } from '../utils/date';
import { logService } from '../lib/services';
import { useHistoryData } from '../hooks/useHistoryData';
import { BackupReminder } from './BackupReminder';
import {Card, CountUp, ProgressBar, ProgressRing, SectionTitle, Skeleton} from '../ui/primitives';
import { cx } from '../ui/cx';
import { cardIn, listItem, spring, stagger } from '../ui/motion';

// The history tab and the edit modal are not part of the first paint. Splitting
// them keeps the initial bundle to what the Today view actually needs; they
// load on the tap that reveals them.
const CalendarView = lazy(() => import('./CalendarView').then((m) => ({ default: m.CalendarView })));
const HistoryStatsView = lazy(() => import('./HistoryStatsView').then((m) => ({ default: m.HistoryStatsView })));
const DayLogView = lazy(() => import('./DayLogView').then((m) => ({ default: m.DayLogView })));
const EditFoodModal = lazy(() => import('./EditFoodModal').then((m) => ({ default: m.EditFoodModal })));

/** Shown while the history chunk is in flight — mirrors its real layout. */
const HistorySkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-[300px] w-full" />
    <div className="grid grid-cols-2 gap-3">
      <Skeleton className="h-[68px]" />
      <Skeleton className="h-[68px]" />
    </div>
    <Skeleton className="h-[190px] w-full" />
  </div>
);

interface NutritionDashboardProps {
  logs: FoodEntry[];
  dailyGoal: DailyGoal;
  onDeleteFoodLog: (id: string) => void;
  onUpdateFoodLog: (updatedEntry: FoodEntry) => Promise<void>;
  onClearAll: () => void;
  onCloseMobile?: () => void;
  onOpenBackup: () => void;
}

const MACRO_META = [
  { key: 'protein', label: 'Protein', color: '#FFFFFF', emoji: '🍗' },
  { key: 'carbs', label: 'Carbs', color: '#DCDCE0', emoji: '🍞' },
  { key: 'fat', label: 'Fat', color: '#B8B8C0', emoji: '🥑' },
  { key: 'sugar', label: 'Sugar', color: '#9A9AA3', emoji: '🍬' },
  { key: 'fiber', label: 'Fiber', color: '#7E7E88', emoji: '🥦' },
] as const;

function greeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 5) return { text: 'Still up?', emoji: '🌙' };
  if (h < 12) return { text: 'Good morning', emoji: '☀️' };
  if (h < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  if (h < 21) return { text: 'Good evening', emoji: '🌇' };
  return { text: 'Good night', emoji: '🌙' };
}

export const NutritionDashboard: React.FC<NutritionDashboardProps> = ({
  logs,
  dailyGoal,
  onDeleteFoodLog,
  onUpdateFoodLog,
  onClearAll,
  onCloseMobile,
  onOpenBackup,
}) => {
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  /** Bumped on dismissal so the reminder re-evaluates instead of lingering. */
  const [backupNudge, setBackupNudge] = useState(0);
  const [activeEditEntry, setActiveEditEntry] = useState<FoodEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Today totals
  const totalCalories = logs.reduce((acc, curr) => acc + (curr.calories || 0), 0);
  const totalProtein = Math.round(logs.reduce((acc, curr) => acc + (curr.protein || 0), 0) * 10) / 10;
  const totalCarbs = Math.round(logs.reduce((acc, curr) => acc + (curr.carbs || 0), 0) * 10) / 10;
  const totalFat = Math.round(logs.reduce((acc, curr) => acc + (curr.fats || 0), 0) * 10) / 10;
  const totalSugar = Math.round(logs.reduce((acc, curr) => acc + (curr.sugar || 0), 0) * 10) / 10;
  const totalFiber = Math.round(logs.reduce((acc, curr) => acc + (curr.fiber || 0), 0) * 10) / 10;

  const calPercent = Math.min(Math.round((totalCalories / dailyGoal.calories) * 105) / 105, 1);
  const proPercent = Math.min(Math.round((totalProtein / dailyGoal.protein) * 105) / 105, 1);
  const carbPercent = Math.min(Math.round((totalCarbs / dailyGoal.carbs) * 105) / 105, 1);
  const fatPercent = Math.min(Math.round((totalFat / dailyGoal.fat) * 105) / 105, 1);
  const sugarPercent = Math.min(Math.round((totalSugar / (dailyGoal.sugar || 50)) * 105) / 105, 1);
  const fiberPercent = Math.min(Math.round((totalFiber / (dailyGoal.fiber || 30)) * 105) / 105, 1);

  // History state — the data itself is derived from local storage below.
  const [selectedDate, setSelectedDate] = useState<string>(getLocalIsoDate());
  const [currentMonth, setCurrentMonth] = useState<string>(getLocalIsoDate().slice(0, 7));

  // Replaces five Supabase queries. Reads are local and synchronous, so these
  // recompute from the store on any change instead of being refetched.
  const { loggedDays, selectedDateLog, stats } = useHistoryData(selectedDate, currentMonth);

  // Handle deletion inside history tab
  const handleDeleteHistoryEntry = async (id: string) => {
    // If the entry matches one of today's logs, call parent handler
    if (logs.some((item) => item.id === id)) {
      onDeleteFoodLog(id);
      return;
    }

    // Delete past log. The views above re-derive themselves from the store.
    logService.deleteLog(id);
  };

  const macroRows = [
    { ...MACRO_META[0], value: totalProtein, goal: dailyGoal.protein, percent: proPercent },
    { ...MACRO_META[1], value: totalCarbs, goal: dailyGoal.carbs, percent: carbPercent },
    { ...MACRO_META[2], value: totalFat, goal: dailyGoal.fat, percent: fatPercent },
    { ...MACRO_META[3], value: totalSugar, goal: dailyGoal.sugar || 50, percent: sugarPercent },
    { ...MACRO_META[4], value: totalFiber, goal: dailyGoal.fiber || 30, percent: fiberPercent },
  ];

  const goalReached = totalCalories >= dailyGoal.calories && dailyGoal.calories > 0;
  const remaining = Math.max(0, dailyGoal.calories - totalCalories);
  const { text: greetText, emoji: greetEmoji } = greeting();

  return (
    <div className="w-full h-full flex flex-col overflow-hidden lg:border-l lg:border-white/[0.07]">
      {/* ── Tab switcher ── */}
      <div className="px-3 sm:px-4 pt-3 pb-2.5 shrink-0 glass border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-2.5">
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-xl bg-surface-card text-fg-muted shadow-soft"
              aria-label="Close panel"
            >
              <Target className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-1 bg-surface-raised/70 rounded-full p-1 relative">
          {(['today', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-full text-xs font-extrabold relative touch-manipulation transition-colors duration-200"
            >
              {activeTab === tab && (
                <motion.span
                  layoutId="panel-tab"
                  className="absolute inset-0 rounded-full grad-accent shadow-glow"
                  transition={spring}
                />
              )}
              <span className={cx('relative', activeTab === tab ? 'text-surface-base' : 'text-fg-dim')}>
                {tab === 'today' ? 'Today' : 'History'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4">
        <AnimatePresence mode="wait">
          {activeTab === 'today' ? (
            <motion.div
              key="today"
              variants={stagger(0.07)}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
              className="space-y-4"
            >
              {/* Only appears once there is a meaningful amount to lose. */}
              <motion.div variants={cardIn}>
                <BackupReminder
                  key={backupNudge}
                  onDismissed={() => setBackupNudge((n) => n + 1)}
                  onOpenBackup={onOpenBackup}
                />
              </motion.div>

              {/* ── Hero: greeting + calorie ring ── */}
              <Card variants={cardIn} className="overflow-hidden relative">
                <div className="flex items-center gap-2 mb-1">
                  <motion.span
                    animate={{ rotate: [0, 14, -8, 0] }}
                    transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 3 }}
                    className="text-lg"
                    role="img"
                    aria-hidden
                  >
                    {greetEmoji}
                  </motion.span>
                  <p className="text-sm font-extrabold text-fg-muted">{greetText}!</p>
                </div>

                <h2 className="text-base font-extrabold text-fg-strong mb-3">
                  {goalReached ? 'Goal smashed today' : "Here's your day so far"}
                </h2>

                <div className="flex flex-col items-center">
                  <ProgressRing
                    progress={calPercent}
                    size={186}
                    stroke={17}
                    gradientId="calorie-ring"
                    from={goalReached ? '#FFFFFF' : '#FFFFFF'}
                    to={goalReached ? '#D4D4D8' : '#A1A1AA'}
                  >
                    <motion.div
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ ...spring, delay: 0.25 }}
                      className="flex flex-col items-center"
                    >
                      <Flame
                        className={cx('w-5 h-5 mb-1', goalReached ? 'text-accent' : 'text-accent')}
                      />
                      <span className="text-4xl font-extrabold text-fg-strong leading-none num">
                        <CountUp value={totalCalories} />
                      </span>
                      <span className="text-[11px] font-bold text-fg-dim mt-1">
                        of {dailyGoal.calories} kcal
                      </span>
                    </motion.div>
                  </ProgressRing>

                  {/* Remaining / celebration */}
                  <AnimatePresence mode="wait">
                    {goalReached ? (
                      <motion.div
                        key="reached"
                        initial={{ opacity: 0, scale: 0.8, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={spring}
                        className="mt-3 chip grad-accent px-4 py-2 text-xs shadow-glow"
                      >
                        <motion.span
                          animate={{ rotate: [0, -18, 18, 0] }}
                          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.6 }}
                        >
                          <PartyPopper className="w-4 h-4" />
                        </motion.span>
                        Daily goal reached!
                      </motion.div>
                    ) : (
                      <motion.div
                        key="remaining"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-3 chip bg-surface-inset text-fg-base px-4 py-2 text-xs"
                      >
                        <span className="num font-extrabold text-accent">{remaining}</span>
                        kcal to go
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Card>

              {/* ── Streak + entries ── */}
              <motion.div variants={cardIn} className="grid grid-cols-2 gap-3">
                <Card padded={false} className="p-3.5 flex items-center gap-2.5" interactive>
                  <div className="w-10 h-10 rounded-2xl grad-tile flex items-center justify-center shrink-0 shadow-soft">
                    <span className="text-lg" role="img" aria-hidden>🔥</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-extrabold text-fg-dim uppercase tracking-wide">Streak</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-extrabold text-fg-strong num leading-tight">
                        <CountUp value={stats.streak} />
                      </span>
                      <span className="text-[11px] text-fg-dim font-bold">days</span>
                    </div>
                  </div>
                </Card>

                <Card padded={false} className="p-3.5 flex items-center gap-2.5" interactive>
                  <div className="w-10 h-10 rounded-2xl grad-tile flex items-center justify-center shrink-0 shadow-soft">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-extrabold text-fg-dim uppercase tracking-wide">Items</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-extrabold text-fg-strong num leading-tight">
                        <CountUp value={logs.length} />
                      </span>
                      <span className="text-[11px] text-fg-dim font-bold">today</span>
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* ── Macros ── */}
              <motion.div variants={cardIn} className="space-y-2.5">
                <SectionTitle icon={<span role="img" aria-hidden>⚡</span>}>Macros</SectionTitle>
                <Card className="space-y-4">
                  {macroRows.map((macro, i) => (
                    <div key={macro.label}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-extrabold text-fg-base flex items-center gap-1.5 text-xs">
                          <span role="img" aria-hidden>{macro.emoji}</span>
                          {macro.label}
                        </span>
                        <span className="text-fg-dim num font-bold text-xs">
                          <strong className="text-fg-strong font-extrabold">{macro.value}g</strong>
                          {' / '}{macro.goal}g
                        </span>
                      </div>
                      <ProgressBar progress={macro.percent} color={macro.color} delay={0.08 * i} />
                    </div>
                  ))}
                </Card>
              </motion.div>

              {/* ── Logged foods ── */}
              <motion.div variants={cardIn} className="space-y-2.5">
                <SectionTitle
                  icon={<span role="img" aria-hidden>🍽️</span>}
                  action={
                    logs.length > 0 ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={onClearAll}
                        className="text-[11px] font-extrabold text-fg-dim hover:text-accent
                                   bg-surface-card px-2.5 py-1.5 rounded-full shadow-soft
                                   flex items-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                      </motion.button>
                    ) : null
                  }
                >
                  Today's food
                </SectionTitle>

                {logs.length === 0 ? (
                  <Card className="flex flex-col items-center text-center py-8">
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                      className="text-3xl mb-2"
                      role="img"
                      aria-hidden
                    >
                      🍱
                    </motion.div>
                    <p className="text-sm font-extrabold text-fg-base">Nothing logged yet</p>
                    <p className="text-[11px] text-fg-dim font-bold mt-1 max-w-[190px] leading-relaxed">
                      Tell the assistant what you ate and it'll appear here.
                    </p>
                  </Card>
                ) : (
                  <motion.div variants={stagger(0.05)} className="space-y-2.5">
                    <AnimatePresence initial={false} mode="popLayout">
                      {logs.map((item) => {
                        const isDeleteConfirming = deleteConfirmId === item.id;
                        return (
                          <motion.div
                            key={item.id}
                            layout
                            variants={listItem}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            className="card p-3.5 group relative overflow-hidden"
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              {isDeleteConfirming ? (
                                <motion.div
                                  key="confirm"
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="flex flex-col items-center gap-2 py-1"
                                >
                                  <p className="text-[11px] text-fg-base font-extrabold flex items-center gap-1.5 text-center">
                                    <AlertTriangle className="w-3.5 h-3.5 text-accent shrink-0" />
                                    Remove “{item.name}”?
                                  </p>
                                  <div className="flex gap-2 text-[11px] font-extrabold">
                                    <motion.button
                                      whileTap={{ scale: 0.94 }}
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="px-3.5 py-1.5 rounded-full bg-surface-inset text-fg-muted"
                                    >
                                      Keep
                                    </motion.button>
                                    <motion.button
                                      whileTap={{ scale: 0.94 }}
                                      onClick={() => {
                                        onDeleteFoodLog(item.id);
                                        setDeleteConfirmId(null);
                                      }}
                                      className="px-3.5 py-1.5 rounded-full grad-accent shadow-glow"
                                    >
                                      Remove
                                    </motion.button>
                                  </div>
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="row"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="flex items-start justify-between gap-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className="text-sm font-extrabold text-fg-strong capitalize truncate"
                                      title={item.name}
                                    >
                                      {item.name}
                                    </p>
                                    <p className="text-[11px] text-fg-dim font-bold num mt-0.5">
                                      {item.quantity} {item.unit}
                                    </p>

                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {[
                                        { l: 'P', v: item.protein, c: '#FFFFFF' },
                                        { l: 'C', v: item.carbs, c: '#DCDCE0' },
                                        { l: 'F', v: item.fats, c: '#B8B8C0' },
                                        { l: 'S', v: item.sugar || 0, c: '#9A9AA3' },
                                        { l: 'Fib', v: item.fiber || 0, c: '#7E7E88' },
                                      ].map((m) => (
                                        <span
                                          key={m.l}
                                          className="chip px-2 py-0.5 text-[10px]"
                                          style={{ backgroundColor: `${m.c}1A`, color: m.c }}
                                        >
                                          {m.l} {m.v}g
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end gap-2 shrink-0">
                                    <span className="chip grad-accent px-2.5 py-1 text-[11px] shadow-glow num">
                                      {item.calories}
                                    </span>
                                    <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                                      <motion.button
                                        whileHover={{ scale: 1.15 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setActiveEditEntry(item)}
                                        className="p-1.5 text-fg-dim hover:text-accent rounded-full hover:bg-white/[0.06]"
                                        aria-label={`Edit ${item.name}`}
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </motion.button>
                                      <motion.button
                                        whileHover={{ scale: 1.15 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setDeleteConfirmId(item.id)}
                                        className="p-1.5 text-fg-dim hover:text-accent rounded-full hover:bg-white/[0.06]"
                                        aria-label={`Delete ${item.name}`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </motion.button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          ) : (
            /* ── HISTORY ── */
            <motion.div
              key="history"
              variants={stagger(0.07)}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
              className="space-y-4"
            >
              <Suspense fallback={<HistorySkeleton />}>
                <CalendarView
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  loggedDays={loggedDays}
                  onMonthChange={setCurrentMonth}
                />

                <HistoryStatsView
                  streak={stats.streak}
                  weeklyAverage={stats.weeklyAverage}
                  graphData={stats.graphData}
                  selectedDate={selectedDate}
                  onSelectDay={setSelectedDate}
                />

                <DayLogView
                  dateString={selectedDate}
                  items={selectedDateLog.items}
                  totalCalories={selectedDateLog.totalCalories}
                  totalProtein={selectedDateLog.totalProtein}
                  totalCarbs={selectedDateLog.totalCarbs}
                  totalFats={selectedDateLog.totalFats}
                  totalSugar={selectedDateLog.totalSugar}
                  totalFiber={selectedDateLog.totalFiber}
                  onDeleteEntry={handleDeleteHistoryEntry}
                  onSelectDate={setSelectedDate}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {activeEditEntry && (
          <Suspense key={`edit-${activeEditEntry.id}`} fallback={null}>
            <EditFoodModal
              entry={activeEditEntry}
              isOpen={!!activeEditEntry}
              onClose={() => setActiveEditEntry(null)}
              onSave={onUpdateFoodLog}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
};
