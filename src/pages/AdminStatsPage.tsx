import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AdminLayout } from '../components/AdminLayout';
import { DashboardCard } from '../components/DashboardCard';
import { LoadingState } from '../components/LoadingState';
import { SizeDistributionChart } from '../components/SizeDistributionChart';
import { StatsCard } from '../components/StatsCard';
import { useAdminData } from '../hooks/useAdminData';
import { calculateDashboardMetrics } from '../utils/sizeEngine';

const MODE_COLORS = ['#ED1010', '#38BDF8'];

export function AdminStatsPage() {
  const {
    contracts,
    registrations,
    productionOrders,
    bulkSubmissions,
    settings,
    loading,
  } = useAdminData();

  const metrics = useMemo(
    () => calculateDashboardMetrics(contracts, registrations, settings.defaultSizes),
    [contracts, registrations, settings.defaultSizes]
  );

  const modeBreakdown = useMemo(() => {
    const active = registrations.filter((r) => r.registrationStatus !== 'cancelled');
    const bulkCount = active.filter(
      (r) => r.registrationMode === 'bulk' || r.source === 'bulk_representative'
    ).length;
    const indivCount = active.length - bulkCount;
    return [
      { name: 'Registro Individual', value: indivCount },
      { name: 'Registro Masivo Org.', value: bulkCount },
    ];
  }, [registrations]);

  const contractComparison = useMemo(() => {
    return contracts.slice(0, 8).map((c) => ({
      code: c.contractCode,
      participantes: registrations.filter(
        (r) => r.contractId === c.contractId && r.registrationStatus !== 'cancelled'
      ).length,
    }));
  }, [contracts, registrations]);

  return (
    <AdminLayout
      title="Estadísticas y Analítica"
      breadcrumb="Distribución por Tallas, Modalidades y Contratos"
    >
      {loading ? (
        <LoadingState label="Calculando estadísticas globales..." rows={5} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard label="Total Participantes" value={metrics.totalParticipants} accent="red" />
            <StatsCard
              label="Tasa Verificación Pagos"
              value={
                metrics.totalParticipants > 0
                  ? `${Math.round((metrics.verifiedPayments / metrics.totalParticipants) * 100)}%`
                  : '0%'
              }
              sublabel={`${metrics.verifiedPayments} verificados`}
              accent="green"
            />
            <StatsCard
              label="Envíos Masivos Org."
              value={bulkSubmissions.length}
              sublabel={`${modeBreakdown[1].value} atletas en lote`}
            />
            <StatsCard
              label="Órdenes de Fabricación"
              value={productionOrders.length}
              sublabel={`${productionOrders.filter((o) => o.isFrozen).length} aprobadas`}
            />
          </div>

          <SizeDistributionChart metrics={metrics} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <DashboardCard
              title="Participantes por Contrato"
              subtitle="Comparativa de volumen entre contratos"
              className="lg:col-span-7"
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contractComparison}>
                    <XAxis dataKey="code" stroke="#888888" fontSize={11} />
                    <YAxis stroke="#888888" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#141414',
                        borderColor: '#292929',
                        color: '#FFFFFF',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="participantes" fill="#ED1010" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DashboardCard>

            <DashboardCard
              title="Origen: Individual vs Masivo"
              subtitle="Distribución de registros por canal"
              className="lg:col-span-5"
            >
              <div className="h-72 flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={modeBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={3}
                    >
                      {modeBreakdown.map((_, idx) => (
                        <Cell key={idx} fill={MODE_COLORS[idx % MODE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#141414',
                        borderColor: '#292929',
                        color: '#FFFFFF',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
                  {modeBreakdown.map((item, idx) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: MODE_COLORS[idx] }}
                      />
                      <span className="text-[#CCCCCC]">{item.name}:</span>
                      <strong className="font-mono text-white">{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </DashboardCard>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
