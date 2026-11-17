import React from 'react';

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DashboardCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: DashboardCardProps) {
  return (
    <section className={`bg-[#141414] border border-[#292929] rounded-lg p-5 sm:p-6 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#292929]">
        <div>
          <h2 className="font-display text-lg uppercase tracking-wide text-white">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-[#888888] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}
