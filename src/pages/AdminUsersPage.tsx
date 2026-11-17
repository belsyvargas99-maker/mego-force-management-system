import React, { useEffect, useState } from 'react';
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../components/AdminLayout';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { DashboardCard } from '../components/DashboardCard';
import { useAuth } from '../hooks/useAuth';
import { subscribeAuditLogs } from '../services/auditService';
import {
  addAuthorizedAdmin,
  BOOTSTRAP_ADMIN_EMAIL,
  removeAuthorizedAdmin,
  subscribeAuthorizedAdmins,
  updateAuthorizedAdmin,
} from '../services/settingsService';
import type { AdminRole, AuditLog, AuthorizedAdmin } from '../types/mego';

export function AdminUsersPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AuthorizedAdmin[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('admin');
  const [adding, setAdding] = useState(false);
  const [toRemove, setToRemove] = useState<AuthorizedAdmin | null>(null);

  useEffect(() => {
    const u1 = subscribeAuthorizedAdmins(setAdmins);
    const u2 = subscribeAuditLogs(setAuditLogs);
    return () => {
      u1();
      u2();
    };
  }, []);

  const adminInfo = {
    uid: user?.uid || 'admin',
    email: user?.email || BOOTSTRAP_ADMIN_EMAIL,
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      await addAuthorizedAdmin(newEmail, newRole, adminInfo);
      toast.success(`Administrador autorizado: ${newEmail.trim().toLowerCase()}`);
      setNewEmail('');
    } catch (err: any) {
      toast.error(err?.message || 'Error al autorizar administrador.');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (adm: AuthorizedAdmin) => {
    if (adm.email === BOOTSTRAP_ADMIN_EMAIL) {
      toast.error('No se puede desactivar al administrador principal.');
      return;
    }
    try {
      await updateAuthorizedAdmin(
        adm.email,
        { role: adm.role, active: !adm.active },
        adminInfo
      );
      toast.success('Permisos actualizados.');
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar permisos.');
    }
  };

  const handleConfirmRemove = async () => {
    if (!toRemove) return;
    try {
      await removeAuthorizedAdmin(toRemove.email, adminInfo);
      toast.success('Administrador removido de la lista autorizada.');
      setToRemove(null);
    } catch (err: any) {
      toast.error(err?.message || 'Error al remover administrador.');
    }
  };

  return (
    <AdminLayout title="Administradores y Auditoría" breadcrumb="Control de Acceso RBAC y Bitácora">
      <div className="space-y-6">
        <div className="bg-[#141414] border border-[#ED1010]/40 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#ED1010] shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <p className="text-sm font-semibold text-white">
                Correo Oficial Principal Vinculado: <span className="font-mono text-[#4ADE80]">{BOOTSTRAP_ADMIN_EMAIL}</span>
              </p>
              <p className="text-[#B5B5B5]">
                Validado en Firebase Authentication (Google Sign-In con verificación de correo) y protegido en las reglas de seguridad de Firestore como Super Admin principal.
              </p>
            </div>
          </div>
        </div>

        <DashboardCard
          title="Autorizar Nuevo Administrador"
          subtitle="Solo las cuentas en esta lista pueden acceder al panel privado mediante Google Sign-In"
        >
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="correo@empresa.com"
              className="flex-1 h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm text-white outline-none focus:border-[#ED1010]"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as AdminRole)}
              aria-label="Rol administrativo"
              className="h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm text-white"
            >
              <option value="admin">Administrador</option>
              <option value="operator">Operador de Producción</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <button
              type="submit"
              disabled={adding}
              className="h-10 px-5 bg-[#ED1010] hover:bg-[#c80d0d] disabled:opacity-50 text-white text-sm font-semibold rounded inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              Autorizar Acceso
            </button>
          </form>
        </DashboardCard>

        <DashboardCard title="Lista de Administradores Autorizados">
          <div className="divide-y divide-[#222222]">
            {admins.map((adm) => {
              const isRoot = adm.email === BOOTSTRAP_ADMIN_EMAIL;
              return (
                <div
                  key={adm.email}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-[#ED1010] shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white">{adm.email}</p>
                      <p className="text-xs text-[#888888]">
                        Rol: {adm.role} · Agregado por {adm.addedBy}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isRoot}
                      onClick={() => handleToggleActive(adm)}
                      className={`px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50 ${
                        adm.active
                          ? 'bg-[#16A34A]/15 text-[#4ADE80]'
                          : 'bg-[#292929] text-[#888888]'
                      }`}
                    >
                      {adm.active ? 'Activo' : 'Suspendido'}
                    </button>
                    {!isRoot && (
                      <button
                        type="button"
                        onClick={() => setToRemove(adm)}
                        aria-label={`Eliminar acceso de ${adm.email}`}
                        className="p-2 rounded bg-[#1C1C1C] hover:bg-[#ED1010]/20 text-[#F87171]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardCard>

        <DashboardCard
          title="Bitácora Inmutable de Auditoría"
          subtitle="Registro cronológico de todas las operaciones administrativas"
        >
          {auditLogs.length === 0 ? (
            <p className="text-sm text-[#888888]">Sin eventos de auditoría todavía.</p>
          ) : (
            <div className="divide-y divide-[#222222] max-h-96 overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.logId} className="py-3 text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-white">
                      {log.action} · <span className="text-[#ED1010]">{log.entityType}</span>
                    </span>
                    <span className="font-mono text-[#888888] tabular-nums">
                      {log.userEmail} · {new Date(log.createdAt).toLocaleString('es-ES')}
                    </span>
                  </div>
                  <p className="text-[#888888] font-mono">
                    ID: {log.entityId} ·{' '}
                    {log.changedFields.map((c) => `${c.field}: ${c.newValue}`).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>

      <ConfirmationModal
        open={Boolean(toRemove)}
        title="Revocar Acceso Administrativo"
        description={`¿Confirmas revocar el acceso administrativo a ${toRemove?.email}?`}
        confirmLabel="Sí, revocar acceso"
        onConfirm={handleConfirmRemove}
        onCancel={() => setToRemove(null)}
      />
    </AdminLayout>
  );
}
