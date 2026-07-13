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
  selectedDate?: string;
  onSelectDay?: (date: string) => void;
}

export const HistoryStatsView: React.FC<HistoryStatsViewProps> = ({
  streak,
  weeklyAverage,
  graphData,
  selectedDate,
  onSelectDay,
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
    <div className="w-full space-y-4 font-sans text-zinc-100">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3.5">
        {/* Streak card */}
        <div className="p-3 sm:p-4 card flex items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-950 text-white border border-zinc-700 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 fill-white/15" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] sm:text-[10px] font-semibold text-zinc-500 uppercase tracking-wider truncate">
              Streak
            </div>
            <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
              <span className="text-lg sm:text-xl font-bold num text-white leading-tight">{streak}</span>
              <span className="text-[10px] sm:text-xs text-zinc-500 font-medium">days</span>
            </div>
          </div>
        </div>

        {/* Weekly average card */}
        <div className="p-3 sm:p-4 card flex items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-950 text-white border border-zinc-700 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 fill-white/15" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] sm:text-[10px] font-semibold text-zinc-500 uppercase tracking-wider truncate">
              Avg Calories
            </div>
            <div className="flex items-baseline gap-0.5 sm:gap-1 mt-0.5 flex-wrap">
              <span className="text-lg sm:text-xl font-bold num text-white leading-tight">{weeklyAverage}</span>
              <span className="text-[9px] sm:text-[10px] text-zinc-500 font-medium">kcal/day</span>
            </div>
          </div>
        </div>
      </div>

      {/* SVG Calorie Graph Card */}
      <div className="p-3.5 sm:p-4 card space-y-3.5">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Calorie Intake
          </span>
          <span className="text-[9px] font-semibold bg-zinc-950 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-800">
            Last 7 days
          </span>
        </div>

        {/* SVG Graph rendering */}
        <div className="relative pt-2">
          {graphData.length === 0 ? (
            <div className="h-[100px] flex items-center justify-center text-zinc-500 text-xs">
              No stats available
            </div>
          ) : (
            <div className="w-full flex flex-col gap-2">
              <svg viewBox="0 0 300 120" className="w-full h-28">
                {/* Grid Lines */}
                <line x1="10" y1="20" x2="290" y2="20" stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3,3" />
                <line x1="10" y1="55" x2="290" y2="55" stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3,3" />
                <line x1="10" y1="90" x2="290" y2="90" stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3,3" />

                {/* Bars */}
                {graphData.map((day, idx) => {
                  const x = 20 + idx * 38;
                  const barHeight = maxCalories > 0 ? (day.calories / maxCalories) * 85 : 0;
                  const y = 95 - barHeight;
                  const isToday = idx === 6;
                  const isSelected = selectedDate === day.date;

                  return (
                    <g
                      key={day.date}
                      className="group cursor-pointer"
                      onClick={() => onSelectDay?.(day.date)}
                    >
                      {/* Invisible hit area — makes short/empty bars easy to tap */}
                      <rect
                        x={x - 8}
                        y="10"
                        width="36"
                        height="105"
                        fill="transparent"
                      />

                      {/* Interactive Bar */}
                      <rect
                        x={x}
                        y={y}
                        width="20"
                        height={Math.max(2, barHeight)}
                        rx="6"
                        fill={isSelected ? '#FFFFFF' : isToday ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.22)'}
                        className="transition-all duration-300 group-hover:fill-white"
                      />

                      {/* Calorie Text Tooltip (Visible on hover / standard top) */}
                      {day.calories > 0 && (
                        <text
                          x={x + 10}
                          y={y - 5}
                          textAnchor="middle"
                          fontSize="8"
                          fill="rgba(255, 255, 255, 0.6)"
                          className="font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
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
                        fill={isSelected || isToday ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)'}
                        className="font-bold"
                      >
                        {getDayLabel(day.date)}
                      </text>
                    </g>
                  );
                })}

                {/* Bottom Baseline */}
                <line x1="10" y1="96" x2="290" y2="96" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
