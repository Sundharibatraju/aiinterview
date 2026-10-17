import React from 'react';

interface CircularProgressBarProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  labelPosition?: 'inside' | 'bottom' | 'side';
  className?: string;
}

export const CircularProgressBar: React.FC<CircularProgressBarProps> = ({
  percentage,
  size = 72,
  strokeWidth = 6,
  showLabel = true,
  labelPosition = 'inside',
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const getColor = (pct: number) => {
    if (pct >= 100) return '#10b981'; // emerald-500
    if (pct >= 80) return '#2563eb';  // blue-600
    if (pct >= 50) return '#f59e0b';  // amber-500
    return '#ef4444';                 // rose-500
  };

  const strokeColor = getColor(clamped);

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="rotate-[-90deg] transition-all duration-500 ease-out"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Foreground progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {showLabel && labelPosition === 'inside' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span
              className="font-extrabold tracking-tight"
              style={{
                fontSize: size >= 70 ? '14px' : '11px',
                color: strokeColor,
              }}
            >
              {clamped}%
            </span>
          </div>
        )}
      </div>

      {showLabel && labelPosition === 'side' && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-extrabold" style={{ color: strokeColor }}>
              {clamped}%
            </span>
            <span className="text-xs font-semibold text-slate-700">Profile Complete</span>
          </div>
          <span className="text-[11px] text-slate-500">
            {clamped >= 100
              ? 'Ready to apply for jobs'
              : 'Complete 10th, 12th/Diploma, Degree & skills'}
          </span>
        </div>
      )}
    </div>
  );
};
