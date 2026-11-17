import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../components/AdminLayout';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ContractCard } from '../components/ContractCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { SearchBar } from '../components/SearchBar';
import { useAdminData } from '../hooks/useAdminData';
import { useAuth } from '../hooks/useAuth';
import {
  deleteContract,
  duplicateContract,
  reopenOrExtendContractSchedule,
} from '../services/contractsService';
import type { Contract } from '../types/mego';

export function AdminContractsPage() {
  const { user } = useAuth();
  const { contracts, registrations, loading } = useAdminData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toDelete, setToDelete] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (q) {
        const hay = `${c.title} ${c.contractCode} ${c.organizationName} ${c.garmentType}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contracts, search, statusFilter]);

  const adminInfo = {
    uid: user?.uid || 'admin',
    email: user?.email || 'admin@megoforce.com',
  };

  const handleDuplicate = async (contract: Contract) => {
    try {
      await duplicateContract(contract, adminInfo);
      toast.success('Contrato duplicado como Borrador (sin participantes).');
    } catch (err: any) {
      toast.error(err?.message || 'Error al duplicar contrato.');
    }
  };

  const handleToggleStatus = async (contract: Contract) => {
    const isClosing = contract.status === 'active';
    const nextStatus = isClosing ? 'closed' : 'active';
    try {
      await reopenOrExtendContractSchedule(
        contract,
        {
          status: nextStatus,
          action: isClosing ? 'manual_closed' : 'manual_reopened',
          reason: isClosing
            ? 'Cierre manual desde listado de contratos'
            : 'Reapertura manual desde listado de contratos',
        },
        adminInfo
      );
      toast.success(
        nextStatus === 'active'
          ? 'Contrato activado: registros públicos habilitados.'
          : 'Contrato cerrado: nuevos registros bloqueados.'
      );
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo cambiar el estado.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteContract(toDelete, adminInfo);
      toast.success('Contrato eliminado correctamente.');
      setToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar contrato.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout title="Contratos" breadcrumb="Gestión de Contratos Oficiales">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 max-w-md">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar contrato, código u organización..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado"
              className="h-10 px-3 bg-[#141414] border border-[#292929] rounded-md text-sm text-white outline-none"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Abiertos / Activos</option>
              <option value="scheduled">Programados</option>
              <option value="draft">Borradores</option>
              <option value="paused">Pausados</option>
              <option value="auto_closed">Cerrados automáticamente</option>
              <option value="closed">Cerrados manualmente</option>
              <option value="finished">Finalizados</option>
              <option value="archived">Archivados</option>
            </select>

            <Link
              to="/admin/contracts/new"
              className="h-10 px-4 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-sm font-semibold rounded-md inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Crear Contrato
            </Link>
          </div>
        </div>

        {loading ? (
          <LoadingState label="Cargando contratos..." rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Sin contratos encontrados"
            description="Crea un contrato nuevo para generar un enlace exclusivo de registro y personalizar sus tallas y mockups."
            icon={<FileText className="w-6 h-6" />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((c) => {
              const count = registrations.filter(
                (r) => r.contractId === c.contractId && r.registrationStatus !== 'cancelled'
              ).length;
              return (
                <ContractCard
                  key={c.contractId}
                  contract={c}
                  participantCount={count}
                  onDuplicate={handleDuplicate}
                  onDelete={setToDelete}
                  onToggleStatus={handleToggleStatus}
                />
              );
            })}
          </div>
        )}
      </div>

      <ConfirmationModal
        open={Boolean(toDelete)}
        title="Eliminar Contrato"
        description={`¿Confirmas la eliminación de "${toDelete?.title}" (${toDelete?.contractCode})? El enlace público dejará de funcionar inmediatamente.`}
        confirmLabel="Sí, eliminar contrato"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </AdminLayout>
  );
}
