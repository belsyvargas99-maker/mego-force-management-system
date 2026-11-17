import React from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { PaymentSelection, PaymentVerificationStatus } from '../types/mego';

export function PaymentStatusBadge({
  selection,
  verificationStatus,
}: {
  selection?: PaymentSelection;
  verificationStatus: PaymentVerificationStatus;
}) {
  const statusConfig = {
    verified: {
      label: 'Verificado',
      classes: 'text-[#4ADE80] border-[#16A34A]/40 bg-[#16A34A]/10',
      Icon: CheckCircle2,
    },
    rejected: {
      label: 'Rechazado',
      classes: 'text-[#F87171] border-[#ED1010]/40 bg-[#ED1010]/10',
      Icon: XCircle,
    },
    pending: {
      label: 'Pendiente',
      classes: 'text-[#FBBF24] border-[#D97706]/40 bg-[#D97706]/10',
      Icon: Clock,
    },
  }[verificationStatus];

  const Icon = statusConfig.Icon;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {selection && (
        <span className="text-[#D4D4D4] font-medium whitespace-nowrap">
          {selection}
        </span>
      )}
      {selection && <span className="text-[#525252]" aria-hidden="true">·</span>}
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-medium whitespace-nowrap ${statusConfig.classes}`}
      >
        <Icon className="w-3 h-3" />
        {statusConfig.label}
      </span>
    </div>
  );
}
