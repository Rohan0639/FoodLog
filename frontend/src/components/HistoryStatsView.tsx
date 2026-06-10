import React from 'react';
import { Zap, Flame } from 'lucide-react';

interface DayMetric {
  date: string;
  calories: number;
}

interface HistoryStatsViewProps {
  streak: number;
  weeklyAverage: number;
  graphData: DayMetric[];
}

export const HistoryStatsView: React.FC<HistoryStatsViewProps> = ({
  streak,
  weeklyAverage,
  graphData,
}) => {
  const maxCalories = Math.max(1500, ...graphData.map((d) => d.calories));

  // Formats date to simple weekday letter/abbreviation (e.g., "M", "T")
  const getDayLabel = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      return days[date.getDay()];
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full space-y-4 font-sans text-white">
      {/* Metrics Row */}
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3.5">
        {/* Streak card */}
        <div className="p-3 sm:p-4 bg-zinc-950 border border-zinc-900 rounded-2xl flex items-center gap-2 sm:gap-3 shadow-inner">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 sm:w-5.5 sm:h-5.5 fill-orange-400/20" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono truncate">
              Streak
            </div>
            <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
              <span className="text-lg sm:text-xl font-bold font-mono text-white leading-tight">{streak}</span>
              <span className="text-[10px] sm:text-xs text-zinc-400 font-medium">days</span>
            </div>
          </div>
        </div>

        {/* Weekly average card */}
        <div className="p-3 sm:p-4 bg-zinc-950 border border-zinc-900 rounded-2xl flex items-center gap-2 sm:gap-3 shadow-inner">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FF7E67]/10 text-[#FF7E67] border border-[#FF7E67]/20 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 sm:w-5.5 sm:h-5.5 fill-[#FF7E67]/20" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono truncate">
              Avg Calories
            </div>
            <div className="flex items-baseline gap-0.5 sm:gap-1 mt-0.5 flex-wrap">
              <span className="text-lg sm:text-xl font-bold font-mono text-white leading-tight">{weeklyAverage}</span>
              <span className="text-[9px] sm:text-[10px] text-zinc-400 font-medium font-mono uppercase">kcal/d</span>
            </div>
          </div>
        </div>
      </div>

      {/* SVG Calorie Graph Card */}
      <div className="p-3 sm:p-4 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-3.5 shadow-inner">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-black text-zinc-550 uppercase tracking-wider font-mono">
            Calorie Intake (Last 7 Days)
          </span>
          <span className="text-[9px] font-bold bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-850">
            Past Week
          </span>
        </div>

        {/* SVG Graph rendering */}
        <div className="relative pt-2">
          {graphData.length === 0 ? (
            <div className="h-[100px] flex items-center justify-center text-zinc-550 text-xs font-mono">
              No stats available
            </div>
          ) : (
            <div className="w-full flex flex-col gap-2">
              <svg viewBox="0 0 300 120" className="w-full h-28 text-zinc-800">
                {/* Grid Lines */}
                <line x1="10" y1="20" x2="290" y2="20" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" />
                <line x1="10" y1="55" x2="290" y2="55" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" />
                <line x1="10" y1="90" x2="290" y2="90" stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3,3" />

                {/* Bars */}
                {graphData.map((day, idx) => {
                  const x = 20 + idx * 38;
                  const barHeight = maxCalories > 0 ? (day.calories / maxCalories) * 85 : 0;
                  const y = 95 - barHeight;
                  const isToday = idx === 6;

                  return (
                    <g key={day.date} className="group cursor-pointer">
                      {/* Interactive Bar */}
                      <rect
                        x={x}
                        y={y}
                        width="20"
                        height={Math.max(2, barHeight)}
                        rx="4"
                        fill={isToday ? '#FF7E67' : 'rgba(255, 255, 255, 0.15)'}
                        className="transition-all duration-300 hover:fill-white/80"
                      />

                      {/* Calorie Text Tooltip (Visible on hover / standard top) */}
                      {day.calories > 0 && (
                        <text
                          x={x + 10}
                          y={y - 5}
                          textAnchor="middle"
                          fontSize="8"
                          fill="rgba(255, 255, 255, 0.6)"
                          className="font-mono font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        >
                          {day.calories}
                        </text>
                      )}

                      {/* Day Label */}
                      <text
                        x={x + 10}
                        y="112"
                        textAnchor="middle"
                        fontSize="9"
                        fill={isToday ? '#FF7E67' : 'rgba(255, 255, 255, 0.4)'}
                        className="font-mono font-black"
                      >
                        {getDayLabel(day.date)}
                      </text>
                    </g>
                  );
                })}

                {/* Bottom Baseline */}
                <line x1="10" y1="96" x2="290" y2="96" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
