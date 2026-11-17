import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="w-full bg-[#141414] border border-[#292929] rounded-lg p-10 text-center flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-lg bg-[#1C1C1C] border border-[#292929] flex items-center justify-center text-[#888888]">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <h3 className="font-display text-xl tracking-wide uppercase text-white">
        {title}
      </h3>
      <p className="text-sm text-[#888888] max-w-md">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 px-5 py-2.5 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-sm font-semibold rounded-md transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
