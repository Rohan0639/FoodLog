import { useState, useEffect, useRef } from 'react';
import type { Message, FoodItem, DailyGoal } from './types';
import { parseFoodMessage, isGreeting } from './utils/parserMock';
import { EmptyState } from './components/EmptyState';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { NutritionDashboard } from './components/NutritionDashboard';
import { Apple, BarChart2, X } from 'lucide-react';
import confetti from 'canvas-confetti';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const DEFAULT_DAILY_GOAL: DailyGoal = {
  calories: 2000,
  protein: 135,
  carbs: 230,
  fat: 70,
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! I'm your digital food diary assistant. Tell me what you ate today (e.g., \"I had 2 bananas and 3 eggs\") and I'll analyze and log the nutrients for you.",
      timestamp: new Date(),
    },
  ]);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [dailyGoal] = useState<DailyGoal>(DEFAULT_DAILY_GOAL);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isDashboardOpenMobile, setIsDashboardOpenMobile] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isBotTyping]);

  const parseQuantity = (quantityStr: string | number) => {
    if (typeof quantityStr === 'number') {
      return { quantity: quantityStr, unit: 'serving' };
    }
    const str = String(quantityStr || '').trim();
    const match = str.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
      return {
        quantity: parseFloat(match[1]),
        unit: match[2] ? match[2].trim() : 'serving'
      };
    }
    return {
      quantity: parseFloat(str) || 1,
      unit: str || 'serving'
    };
  };

  const handleSendMessage = async (text: string) => {
    // Intercept clear/reset commands
    const cleanText = text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    if (cleanText === 'clear' || cleanText === 'reset') {
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      handleClearAll();
      return;
    }

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setIsBotTyping(true);

    try {
      // 1. Call local Express backend POST /parse-food
      const response = await fetch(`${API_URL}/parse-food`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`Parser server returned status: ${response.status}`);
      }

      const parseData = await response.json(); // Expected: { success: true, data: { items: [], totals: {} } }
      const analyzeData = parseData.data || {};
      const items = analyzeData.items || [];
      const totals = analyzeData.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };

      let parsedItems: FoodItem[] = [];
      let replyText = '';

      if (items.length > 0) {
        parsedItems = items.map((item: any, index: number) => {
          const { quantity, unit } = parseQuantity(item.quantity);
          return {
            id: `food-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.name,
            quantity,
            unit,
            calories: Math.round(item.calories || 0),
            protein: Math.round((item.protein || 0) * 10) / 10,
            carbs: Math.round((item.carbs || 0) * 10) / 10,
            fat: Math.round((item.fat || 0) * 10) / 10,
            loggedAt: new Date()
          };
        });

        setFoods((prev) => [...prev, ...parsedItems]);
        
        // Confetti celebration
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.85 },
          colors: ['#ffffff', '#e4e4e7', '#a1a1aa', '#52525b']
        });

        const totalCalories = totals.calories || 0;
        const foodNames = parsedItems.map(f => `"${f.name}" (${f.calories} kcal)`).join(', and ');
        replyText = analyzeData.reply || `Got it! I parsed and logged ${foodNames}. Added a total of **${totalCalories} calories** to your tracker.`;
      } else {
        if (analyzeData.reply) {
          replyText = analyzeData.reply;
        } else if (isGreeting(text)) {
          replyText = `Hello! I'm ready to help you track your food. Just type what you ate, for example: "I had 2 eggs and a banana".`;
        } else {
          replyText = `I couldn't identify any food items in your message. Could you try describing it differently?`;
        }
      }

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: replyText,
        timestamp: new Date(),
        parsedFoods: parsedItems,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error: any) {
      console.warn('Failed to communicate with parse-food backend. Saving raw input locally...', error);
      
      // Save raw input text to localStorage
      try {
        const existingLogs = JSON.parse(localStorage.getItem('offline_food_logs') || '[]');
        existingLogs.push({ text, timestamp: new Date().toISOString() });
        localStorage.setItem('offline_food_logs', JSON.stringify(existingLogs));
      } catch (storageErr) {
        console.error('Failed to write to localStorage:', storageErr);
      }

      const replyText = "Saved offline. Will analyze when online.";

      const botMsg: Message = {
        id: `bot-fallback-${Date.now()}`,
        sender: 'bot',
        text: replyText,
        timestamp: new Date(),
        parsedFoods: [],
      };

      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsBotTyping(false);
    }
  };

  const handleRemoveFood = (id: string) => {
    setFoods((prev) => prev.filter((food) => food.id !== id));
  };

  const handleClearAll = () => {
    setFoods([]);
    const resetMsg: Message = {
      id: `bot-reset-${Date.now()}`,
      sender: 'bot',
      text: "I've reset your daily logs. Ready to record your next meal!",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, resetMsg]);
  };

  // Pre-fill input suggestion
  const handleSelectSuggestion = (text: string) => {
    handleSendMessage(text);
  };

  return (
    <div className="flex flex-row h-screen w-full overflow-hidden bg-black text-white">
      
      {/* LEFT AREA: Chat container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Chat Header */}
        <header className="h-16 border-b border-zinc-900 px-6 flex items-center justify-between bg-black/90 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black shadow">
              <Apple className="w-5 h-5 fill-black/10" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">FoodLog Assistant</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">AI Logging Active</span>
              </div>
            </div>
          </div>

          {/* Collapsible Mobile Dashboard Trigger */}
          <button
            onClick={() => setIsDashboardOpenMobile(!isDashboardOpenMobile)}
            className="lg:hidden p-2 rounded-xl border border-zinc-850 bg-zinc-900/80 text-zinc-350 hover:text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all duration-150"
          >
            <BarChart2 className="w-4.5 h-4.5 text-white" />
            <span className="text-xs font-bold">Stats</span>
            {foods.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-white shrink-0" />
            )}
          </button>
        </header>

        {/* Chat Thread */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-2 max-w-2xl mx-auto w-full">
          {messages.length === 1 && foods.length === 0 ? (
            <EmptyState onSelectSuggestion={handleSelectSuggestion} />
          ) : (
            <div className="flex flex-col gap-1">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              
              {/* Bot typing simulation */}
              {isBotTyping && (
                <ChatMessage
                  message={{
                    id: 'typing',
                    sender: 'bot',
                    text: '',
                    timestamp: new Date(),
                    isTyping: true,
                  }}
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Input Area */}
        <ChatInput onSendMessage={handleSendMessage} disabled={isBotTyping} />
      </div>

      {/* RIGHT AREA: Nutrition Dashboard (Desktop: sidebar, Mobile: toggle slide-over drawer) */}
      
      {/* Desktop Dashboard */}
      <div className="hidden lg:block w-[320px] xl:w-[350px] h-full shrink-0">
        <NutritionDashboard
          foods={foods}
          dailyGoal={dailyGoal}
          onRemoveFood={handleRemoveFood}
          onClearAll={handleClearAll}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {isDashboardOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end animate-fade-in">
          {/* Overlay click to close backdrop */}
          <div
            onClick={() => setIsDashboardOpenMobile(false)}
            className="absolute inset-0 bg-black/85 backdrop-blur-sm transition-opacity duration-300"
          />
          
          {/* Slider content */}
          <div className="relative w-80 max-w-[85%] h-full bg-black border-l border-zinc-900 shadow-2xl flex flex-col animate-slide-up">
            {/* Close button inside mobile slide-over drawer */}
            <button
              onClick={() => setIsDashboardOpenMobile(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-zinc-850 bg-zinc-900 text-zinc-400 hover:text-white z-25 transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="h-full pt-4">
              <NutritionDashboard
                foods={foods}
                dailyGoal={dailyGoal}
                onRemoveFood={handleRemoveFood}
                onClearAll={handleClearAll}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
