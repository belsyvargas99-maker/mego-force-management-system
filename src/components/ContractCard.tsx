import React from 'react';
import { Copy, ExternalLink, Edit3, CopyPlus, Trash2, Users, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { Contract } from '../types/mego';
import { CONTRACT_STATUS_META } from '../utils/contractSchedule';
import { publicUrl as buildClientUrl } from '../config/appMode';

interface ContractCardProps {
  contract: Contract;
  participantCount: number;
  onDuplicate: (contract: Contract) => void;
  onDelete: (contract: Contract) => void;
  onToggleStatus: (contract: Contract) => void;
}

export function ContractCard({
  contract,
  participantCount,
  onDuplicate,
  onDelete,
  onToggleStatus,
}: ContractCardProps) {
  const primaryImg =
    contract.mockupImages?.find((m) => m.isPrimary)?.url ||
    contract.mockupImages?.[0]?.url ||
    '';

  const statusMeta = CONTRACT_STATUS_META[contract.status] || CONTRACT_STATUS_META.draft;
  const publicUrl = buildClientUrl(`/registro/${contract.publicToken}`);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Enlace público copiado.');
    } catch {
      toast.error('No se pudo copiar al portapapeles.');
    }
  };

  return (
    <article className="bg-[#141414] border border-[#292929] rounded-lg overflow-hidden flex flex-col justify-between">
      <div>
        <div className="aspect-[16/9] bg-[#0B0B0B] border-b border-[#292929] relative overflow-hidden">
          {primaryImg ? (
            <img
              src={primaryImg}
              alt={contract.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-[#666666]">
              Sin mockup principal
            </div>
          )}
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-mono text-[#888888]">{contract.contractCode}</span>
            <span className={`font-semibold uppercase ${statusMeta.colorClass}`}>
              {statusMeta.shortLabel}
            </span>
          </div>

          <div>
            <p className="text-xs text-[#888888] truncate">{contract.organizationName}</p>
            <h3 className="font-display text-xl uppercase tracking-wide text-white mt-0.5 line-clamp-2">
              <Link to={`/admin/contracts/${contract.contractId}`} className="hover:text-[#ED1010] transition-colors">
                {contract.title}
              </Link>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#888888] pt-1">
            <span>{contract.garmentType}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums text-white font-medium">
              {participantCount} participantes
            </span>
            {contract.bulkRegistrationEnabled && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#4ADE80]">Masivo activo</span>
              </>
            )}
          </div>
          {(contract.closeDate || contract.endDate) && (
            <p className="text-[11px] font-mono text-[#737373]">
              Cierre: {contract.closeDate || contract.endDate} {contract.closeTime || '23:59'}
            </p>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 pt-3 border-t border-[#222222] space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/admin/contracts/${contract.contractId}/registrations`}
            className="flex-1 h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] text-white text-xs font-medium rounded inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5" />
            Participantes
          </Link>
          <Link
            to={`/admin/contracts/${contract.contractId}/production`}
            className="flex-1 h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] text-white text-xs font-medium rounded inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5" />
            Producción
          </Link>
        </div>

        <div className="flex items-center justify-between gap-1.5 pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={copyLink}
              title="Copiar enlace público"
              aria-label={`Copiar enlace de ${contract.title}`}
              className="h-8 px-2.5 bg-[#0B0B0B] border border-[#292929] hover:border-[#888888] rounded text-xs text-white inline-flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar link
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir formulario público"
              aria-label={`Abrir enlace público de ${contract.title}`}
              className="h-8 w-8 bg-[#0B0B0B] border border-[#292929] hover:border-[#888888] rounded text-white inline-flex items-center justify-center"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleStatus(contract)}
              className="h-8 px-2.5 bg-[#1C1C1C] hover:bg-[#292929] rounded text-[11px] font-medium text-white whitespace-nowrap"
            >
              {contract.status === 'active' ? 'Cerrar' : 'Activar'}
            </button>
            <Link
              to={`/admin/contracts/${contract.contractId}/edit`}
              aria-label={`Editar ${contract.title}`}
              className="h-8 w-8 bg-[#1C1C1C] hover:bg-[#292929] rounded text-white inline-flex items-center justify-center"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => onDuplicate(contract)}
              title="Duplicar contrato"
              aria-label={`Duplicar ${contract.title}`}
              className="h-8 w-8 bg-[#1C1C1C] hover:bg-[#292929] rounded text-white inline-flex items-center justify-center"
            >
              <CopyPlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(contract)}
              title="Eliminar contrato"
              aria-label={`Eliminar ${contract.title}`}
              className="h-8 w-8 bg-[#1C1C1C] hover:bg-[#ED1010]/20 rounded text-[#F87171] inline-flex items-center justify-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
