import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FoodEntry, GeminiResponse, Message, ParsedItem } from '../types';
import { scaleMacrosByQuantity } from '../utils/unitConverter';
import confetti from 'canvas-confetti';
import { analyzeFoodServer } from '../utils/serverParser';
import {
  chatService, dictionaryService, goalService, parseCacheService, settingsService,
} from '../lib/services';
import * as localParser from '../lib/parsing/localParser';
import { splitParts } from '../lib/nlp/normalizeText';
import { newId } from '../lib/storage/schema';
import { getCurrentIsoString, getTodayDate, msUntilMidnight } from '../utils/date';
import { useChatMessages } from '../hooks/useChatMessages';
import { useFoodLog } from '../hooks/useFoodLog';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useDbRevision } from '../hooks/useDbRevision';
import Navbar from '../components/Navbar';
import FoodLogger from '../components/FoodLogger';
import { NutritionDashboard } from '../components/NutritionDashboard';
import { Blobs, ConfirmDialog } from '../ui/primitives';
import { spring } from '../ui/motion';
import { MessageCircle, BarChart2, Trash2 } from 'lucide-react';

// Opened from the navbar, so it is never needed on first paint.
const SettingsSheet = lazy(() =>
  import('../components/SettingsSheet').then((m) => ({ default: m.SettingsSheet }))
);

const generateMessageId = (sender: string): string => `${sender}-${newId()}`;

/**
 * Parses a phrase into food items, spending a network call only when it must.
 *
 *   1. whole-phrase cache — this exact sentence has been parsed before
 *   2. personal dictionary — per fragment, so partial hits still pay off
 *   3. the AI, asked only about the fragments nothing local could answer
 *
 * Foods the user eats regularly stop costing anything at all, and keep working
 * with no connection.
 */
async function analyzeFood(text: string): Promise<GeminiResponse> {
  const cached = parseCacheService.getCachedParse(text);
  if (cached) return cached;

  const local = localParser.matchPhrase(text);
  const localItems = local.matched.map(localParser.toParsedItem);
  const anyGuessed = local.matched.some((match) => match.stage === 'fuzzy');

  // Everything came from foods this device already knows.
  if (localItems.length > 0 && local.unmatched.length === 0) {
    return localParser.buildResponse(localItems, anyGuessed);
  }

  // Ask only about what is genuinely new. Fragments are independent foods, so
  // sending a subset cannot change how the rest are interpreted.
  const query = localItems.length > 0 ? local.unmatched.join(' and ') : text;
  const remote = await analyzeFoodServer(query);

  if (remote.status === 'invalid') {
    // Some fragments were real foods even if the remainder was not — keep them
    // rather than rejecting the whole message.
    if (localItems.length > 0) return localParser.buildResponse(localItems, anyGuessed);
    return remote;
  }

  // Tag AI items with the text that produced them, so confirming teaches the
  // dictionary this phrasing.
  //
  // Only safe when the AI returned exactly one item per fragment we sent. It
  // may legitimately merge or split them ("burger with cheese" is one dish),
  // and a misaligned pairing would teach the wrong spelling to the wrong food.
  const sent = localItems.length > 0 ? local.unmatched : splitParts(text);
  const alignable = (remote.items ?? []).length === sent.length;

  const remoteItems = (remote.items ?? []).map((item, index) => ({
    ...item,
    source: 'ai' as const,
    sourceText: alignable ? sent[index] : undefined,
  }));

  if (localItems.length === 0) {
    const whole = { ...remote, items: remoteItems };
    parseCacheService.setCachedParse(text, whole);
    return whole;
  }

  // Mixed result: don't cache under the full phrase, since only part of it was
  // answered remotely and the local half may change as the dictionary grows.
  const items = [...localItems, ...remoteItems];
  return {
    status: 'valid',
    reply: remote.reply || 'Please review the parsed food items:',
    items,
    totals: localParser.totalsFor(items),
  };
}

const TABS = [
  { id: 'log' as const, label: 'Log', icon: MessageCircle },
  { id: 'progress' as const, label: 'Progress', icon: BarChart2 },
];

export default function Dashboard() {
  const [todayDateStr, setTodayDateStr] = useState<string>(getTodayDate());
  const revision = useDbRevision();
  const isOnline = useOnlineStatus();

  const { messages, setMessages } = useChatMessages(todayDateStr);
  const { logs, addEntries, updateEntry, deleteEntry, clearDay } = useFoodLog(todayDateStr);

  // `revision` is a cache key: goals are re-read whenever the store changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dailyGoal = useMemo(() => goalService.getDailyGoal(), [revision]);

  const [isBotTyping, setIsBotTyping] = useState(false);
  // Mobile app-style navigation: 'log' = chat screen, 'progress' = stats/history screen
  const [mobileTab, setMobileTab] = useState<'log' | 'progress'>('log');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // An unconfirmed review table survives a reload: it is only committed when
  // the user confirms, so it is restored from the persisted transcript.
  const [activeFoods, setActiveFoods] = useState<FoodEntry[]>(
    () => chatService.getPendingReview(getTodayDate())?.foods ?? []
  );
  const [activeReviewMessageId, setActiveReviewMessageId] = useState<string | null>(
    () => chatService.getPendingReview(getTodayDate())?.messageId ?? null
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isBotTyping]);

  // Daily reset at midnight: re-arms itself so the app can stay open for days.
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const armMidnightTimer = () => {
      timeoutId = setTimeout(() => {
        setTodayDateStr(getTodayDate());
        armMidnightTimer();
      }, msUntilMidnight());
    };

    armMidnightTimer();
    return () => clearTimeout(timeoutId);
  }, []);

  // Announces the rollover once the new day's (empty) transcript has loaded.
  // Runs after the chat hook has swapped days, so the notice is not clobbered.
  const previousDate = useRef(todayDateStr);
  useEffect(() => {
    if (previousDate.current === todayDateStr) return;
    previousDate.current = todayDateStr;

    setActiveFoods([]);
    setActiveReviewMessageId(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `bot-midnight-reset-${Date.now()}`,
        sender: 'bot',
        text: 'Midnight reached! A new logging day has started. ☀️ Your previous logs are saved in history.',
        timestamp: new Date(),
      },
    ]);
  }, [todayDateStr, setMessages]);

  const handleSendMessage = async (text: string) => {
    const cleanText = text.toLowerCase().trim().replace(/[.,/#!$%^&*;:{}=_`~()?-]/g, '');

    const userMsg: Message = {
      id: generateMessageId('user'),
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    if (cleanText === 'clear' || cleanText === 'reset') {
      setMessages((prev) => [...prev, userMsg]);
      handleClearAll();
      return;
    }

    setMessages((prev) => [...prev, userMsg]);
    setIsBotTyping(true);

    try {
      const parseData = await analyzeFood(text);

      if (parseData.status === 'invalid') {
        setMessages((prev) => [
          ...prev,
          {
            id: generateMessageId('bot'),
            sender: 'bot',
            text: parseData.reason || 'Input is not a valid food item',
            timestamp: new Date(),
          },
        ]);
        return;
      }

      const items = parseData.items || [];
      const newEntries: FoodEntry[] = items.map((item: ParsedItem) => {
        const rawQty = parseFloat(item.quantity) || 1;
        const rawUnit = item.quantity.replace(/^\d+(?:\.\d+)?\s*/, '') || 'piece';
        return {
          id: newId(),
          name: item.name || 'Unknown',
          quantity: rawQty,
          unit: rawUnit,
          baseQuantity: rawQty,
          baseUnit: rawUnit,
          calories: item.calories || 0,
          protein: item.protein || 0,
          carbs: item.carbs || 0,
          fats: item.fat || 0,
          sugar: item.sugar || 0,
          fiber: item.fiber || 0,
          createdAt: getCurrentIsoString(),
          baseFoodName: item.baseFoodName,
          caloriesPerUnit: item.caloriesPerUnit,
          proteinPerUnit: item.proteinPerUnit,
          carbsPerUnit: item.carbsPerUnit,
          fatPerUnit: item.fatPerUnit,
          sugarPerUnit: item.sugarPerUnit,
          fiberPerUnit: item.fiberPerUnit,
          aliases: item.aliases,
          source: item.source,
          matchConfidence: item.matchConfidence,
          matchStage: item.matchStage,
          sourceText: item.sourceText,
        };
      });

      const botMsgId = generateMessageId('bot');
      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          sender: 'bot',
          text: parseData.reply || 'Please review the parsed food items:',
          timestamp: new Date(),
          pendingFoods: newEntries.length > 0 ? newEntries : undefined,
        },
      ]);

      if (newEntries.length > 0) {
        setActiveReviewMessageId(botMsgId);
        setActiveFoods(newEntries);
      }
    } catch (error) {
      // Logging is local and always available, but *parsing* needs the AI
      // service. Nothing is written when it cannot be reached — a placeholder
      // row with zeroed macros would silently corrupt the day's totals.
      console.warn('Failed to analyze food.', error);
      setMessages((prev) => [
        ...prev,
        {
          id: generateMessageId('bot-error'),
          sender: 'bot',
          text: "I couldn't reach the food parser just now, so nothing was logged. Check your connection and try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsBotTyping(false);
    }
  };

  const handleConfirmLog = () => {
    if (activeFoods.length === 0) return;
    setIsBotTyping(true);

    try {
      const finalizedFoods: FoodEntry[] = activeFoods.map((item: FoodEntry) => {
        const quantity = item.quantity;
        let scaled = {
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fats: item.fats,
          sugar: item.sugar || 0,
          fiber: item.fiber || 0,
        };

        if (quantity > 0 && !isNaN(quantity)) {
          try {
            const baseUnit = item.baseUnit || item.unit;
            const baseQty = item.baseQuantity || item.quantity;
            scaled = scaleMacrosByQuantity(item, quantity, item.unit, baseQty, baseUnit, item.name);
          } catch (err) {
            console.error('Scale error:', err);
          }
        }

        return {
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          calories: scaled.calories,
          protein: scaled.protein,
          carbs: scaled.carbs,
          fats: scaled.fats,
          sugar: scaled.sugar,
          fiber: scaled.fiber,
          createdAt: item.createdAt || getCurrentIsoString(),
        };
      });

      const savedEntries = addEntries(finalizedFoods);

      // Teach the local dictionary what was just confirmed.
      //
      // Learns from `activeFoods`, not `finalizedFoods`: the former still
      // carries the per-unit figures the parser returned (`caloriesPerUnit`,
      // `baseUnit`, `aliases`), which the finalized records drop. Confirm time
      // is the right moment — the user has reviewed these numbers and accepted
      // them. Never allowed to block or fail the log itself.
      try {
        dictionaryService.learnMany(activeFoods, 'gemini');
      } catch (err) {
        console.warn('[dictionary] Could not learn from this log.', err);
      }

      if (settingsService.getSettings().confettiEnabled) {
        confetti({
          particleCount: 110,
          spread: 75,
          origin: { y: 0.8 },
          scalar: 0.95,
          colors: ['#FFFFFF', '#B8B8C0', '#7E7E88', '#DCDCE0', '#9A9AA3'],
        });
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === activeReviewMessageId
            ? {
                ...msg,
                text: 'Logged successfully! 🍳',
                pendingFoods: undefined,
                parsedFoods: savedEntries,
              }
            : msg
        )
      );
    } catch (err) {
      // The only way a local write fails is a blocked or full store. Say so
      // plainly and keep the review table open so nothing is lost.
      console.error('Failed to save entries locally.', err);
      const reason = err instanceof Error ? err.message : 'Your entries could not be saved.';
      setMessages((prev) => [
        ...prev,
        {
          id: generateMessageId('bot-error'),
          sender: 'bot',
          text: reason,
          timestamp: new Date(),
        },
      ]);
      return;
    } finally {
      setIsBotTyping(false);
    }

    setActiveReviewMessageId(null);
    setActiveFoods([]);
  };

  const handleDiscard = () => {
    if (activeReviewMessageId) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === activeReviewMessageId
            ? {
                ...msg,
                text: 'Discarded logging session. ❌',
                pendingFoods: undefined,
                parsedFoods: [],
              }
            : msg
        )
      );
    }
    setActiveReviewMessageId(null);
    setActiveFoods([]);
  };

  const handleDeleteFoodEntry = async (id: string) => {
    deleteEntry(id);
  };

  const handleUpdateFoodEntry = async (updatedEntry: FoodEntry) => {
    updateEntry(updatedEntry);

    // A hand-edited entry is the user's own correction, so it is learned with
    // 'user' precedence — a later parse of the same food will not overwrite it.
    try {
      dictionaryService.learn(updatedEntry, 'user');
    } catch (err) {
      console.warn('[dictionary] Could not learn from this edit.', err);
    }
  };

  /** Opens the confirmation. The clear itself happens in `performClearAll`. */
  const handleClearAll = () => setConfirmClearOpen(true);

  const performClearAll = () => {
    setConfirmClearOpen(false);
    clearDay();

    setMessages((prev) => [
      ...prev,
      {
        id: `bot-reset-${Date.now()}`,
        sender: 'bot',
        text: "I've reset your daily logs. Ready to record your next meal!",
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="flex flex-col w-full overflow-hidden" style={{ height: '100dvh' }}>
      <Blobs />

      <Navbar isOnline={isOnline} onOpenSettings={() => setSettingsOpen(true)} />

      <div className="flex-1 flex flex-row overflow-hidden relative min-h-0">
        {/* Chat / Log screen — always visible on desktop; on mobile only when 'log' tab is active */}
        <div className={`flex-1 min-w-0 min-h-0 flex-col ${mobileTab === 'log' ? 'flex' : 'hidden lg:flex'}`}>
          <FoodLogger
            messages={messages}
            logs={logs}
            activeReviewMessageId={activeReviewMessageId}
            activeFoods={activeFoods}
            setActiveFoods={setActiveFoods}
            isBotTyping={isBotTyping}
            onSendMessage={handleSendMessage}
            onConfirmLog={handleConfirmLog}
            onDiscard={handleDiscard}
            messagesEndRef={messagesEndRef}
          />
        </div>

        {/* Progress screen — side panel on desktop; full-screen tab view on mobile.
            One shared instance so data fetches are never duplicated. */}
        <div
          className={`h-full min-h-0 flex-col ${
            mobileTab === 'progress' ? 'flex w-full' : 'hidden'
          } lg:flex lg:w-[clamp(320px,30vw,420px)] lg:shrink-0`}
        >
          <NutritionDashboard
            key={todayDateStr}
            logs={logs}
            dailyGoal={dailyGoal}
            onDeleteFoodLog={handleDeleteFoodEntry}
            onUpdateFoodLog={handleUpdateFoodEntry}
            onClearAll={handleClearAll}
          />
        </div>
      </div>

      {/* Mobile bottom tab bar — native-app navigation */}
      <nav
        className="lg:hidden glass border-t border-white/[0.06] shrink-0 z-30 flex items-stretch px-3"
        style={{ height: 'var(--tabbar-h)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((tab) => {
          const isActive = mobileTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative touch-manipulation"
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative px-5 py-1.5">
                {/* Shared layout id makes the pill glide between tabs */}
                {isActive && (
                  <motion.div
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-full grad-accent shadow-glow"
                    transition={spring}
                  />
                )}
                <motion.div
                  animate={{ scale: isActive ? 1.06 : 1 }}
                  transition={spring}
                  className={`relative ${isActive ? 'text-surface-base' : 'text-fg-dim'}`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.id === 'progress' && logs.length > 0 && !isActive && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-accent ring-2 ring-surface-base"
                    />
                  )}
                </motion.div>
              </div>
              <span
                className={`text-[10px] font-extrabold transition-colors ${
                  isActive ? 'text-accent' : 'text-fg-dim'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      <AnimatePresence>
        {settingsOpen && (
          <Suspense key="settings" fallback={null}>
            <SettingsSheet
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              dailyGoal={dailyGoal}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmClearOpen && (
          <ConfirmDialog
            key="confirm-clear"
            open={confirmClearOpen}
            icon={<Trash2 className="w-7 h-7" />}
            title="Clear today's log?"
            message="This removes every food item logged today. Your history for other days stays exactly as it is."
            confirmLabel="Clear it"
            cancelLabel="Keep it"
            onConfirm={performClearAll}
            onCancel={() => setConfirmClearOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
