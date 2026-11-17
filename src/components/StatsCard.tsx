import React from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: 'red' | 'green' | 'amber' | 'neutral';
  icon?: React.ReactNode;
}

export function StatsCard({
  label,
  value,
  sublabel,
  accent = 'neutral',
  icon,
}: StatsCardProps) {
  const accentText =
    accent === 'red'
      ? 'text-[#ED1010]'
      : accent === 'green'
        ? 'text-[#4ADE80]'
        : accent === 'amber'
          ? 'text-[#FBBF24]'
          : 'text-white';

  return (
    <div className="bg-[#141414] border border-[#292929] rounded-lg p-5 flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#888888] tracking-wide uppercase">
          {label}
        </span>
        {icon && <span className="text-[#888888]">{icon}</span>}
      </div>
      <div>
        <div className={`font-display text-3xl font-bold tabular-nums leading-none ${accentText}`}>
          {value}
        </div>
        {sublabel && <p className="text-xs text-[#888888] mt-2">{sublabel}</p>}
      </div>
    </div>
  );
}
