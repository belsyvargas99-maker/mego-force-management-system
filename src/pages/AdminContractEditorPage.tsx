import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../components/AdminLayout';
import { ContractForm } from '../components/ContractForm';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { useAuth } from '../hooks/useAuth';
import {
  createContract,
  getContractById,
  updateContract,
} from '../services/contractsService';
import type { Contract } from '../types/mego';

export function AdminContractEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [contract, setContract] = useState<Contract | undefined>(undefined);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getContractById(id)
      .then((c) => {
        if (!c) setNotFound(true);
        else setContract(c);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (payload: any) => {
    if (!user) return;
    setSaving(true);
    const adminInfo = {
      uid: user.uid,
      email: user.email || 'admin@megoforce.com',
    };
    try {
      if (isEditing && id) {
        await updateContract(id, payload, adminInfo);
        toast.success('Contrato actualizado correctamente.');
        navigate(`/admin/contracts/${id}`);
      } else {
        const created = await createContract(payload, adminInfo);
        toast.success('Contrato creado y enlace público generado.');
        navigate(`/admin/contracts/${created.contractId}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar contrato.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title={isEditing ? 'Editar Contrato' : 'Nuevo Contrato'}
      breadcrumb={isEditing ? `Contratos / ${contract?.contractCode || id}` : 'Contratos / Crear'}
    >
      <div className="space-y-4">
        <Link
          to={isEditing && id ? `/admin/contracts/${id}` : '/admin/contracts'}
          className="inline-flex items-center gap-1.5 text-xs text-[#888888] hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver
        </Link>

        {loading ? (
          <LoadingState label="Cargando configuración del contrato..." rows={5} />
        ) : notFound ? (
          <ErrorState message="El contrato solicitado no existe." />
        ) : (
          <ContractForm
            initialContract={contract}
            saving={saving}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </AdminLayout>
  );
}
