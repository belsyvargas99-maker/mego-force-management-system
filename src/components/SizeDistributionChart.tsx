import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';
import type { DashboardMetrics } from '../types/mego';
import { DashboardCard } from './DashboardCard';

interface SizeDistributionChartProps {
  metrics: DashboardMetrics;
}

export function SizeDistributionChart({ metrics }: SizeDistributionChartProps) {
  const hasData = metrics.totalParticipants > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <DashboardCard
        title="Participantes por Talla"
        subtitle="Distribución de producción en tiempo real"
      >
        <div className="h-64 w-full">
          {!hasData ? (
            <div className="h-full flex items-center justify-center text-sm text-[#888888]">
              Aún no hay registros para graficar tallas.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.bySize} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#292929" vertical={false} />
                <XAxis dataKey="size" stroke="#888888" fontSize={12} />
                <YAxis stroke="#888888" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#141414',
                    border: '1px solid #292929',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Cantidad" fill="#ED1010" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </DashboardCard>

      <DashboardCard
        title="Registros por Fecha"
        subtitle="Ritmo de inscripciones cronológicas"
      >
        <div className="h-64 w-full">
          {metrics.byDate.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-[#888888]">
              Sin actividad diaria registrada todavía.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.byDate} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#292929" vertical={false} />
                <XAxis dataKey="date" stroke="#888888" fontSize={11} />
                <YAxis stroke="#888888" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#141414',
                    border: '1px solid #292929',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Registros"
                  stroke="#ED1010"
                  fill="#ED1010"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </DashboardCard>

      <DashboardCard
        title="Participantes por Contrato"
        subtitle="Volumen acumulado por organización"
      >
        <div className="h-64 w-full">
          {metrics.byContract.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-[#888888]">
              Sin contratos con participantes registrados.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.byContract.slice(0, 6)}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#292929" horizontal={false} />
                <XAxis type="number" stroke="#888888" fontSize={12} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="title"
                  stroke="#888888"
                  fontSize={11}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#141414',
                    border: '1px solid #292929',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Participantes" fill="#FFFFFF" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </DashboardCard>

      <DashboardCard
        title="Modalidades de Pago Declaradas"
        subtitle="Distribución declarada por participantes"
      >
        <div className="h-64 w-full flex flex-col sm:flex-row items-center justify-center gap-4">
          {!hasData ? (
            <div className="text-sm text-[#888888]">Sin datos de modalidad de pago.</div>
          ) : (
            <>
              <div className="h-56 w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.byPaymentModality}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={76}
                      paddingAngle={3}
                    >
                      <Cell fill="#ED1010" />
                      <Cell fill="#525252" />
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#141414',
                        border: '1px solid #292929',
                        borderRadius: '6px',
                        color: '#FFFFFF',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-6">
                  <span className="flex items-center gap-2 text-[#E5E5E5]">
                    <span className="w-3 h-3 rounded-sm bg-[#ED1010]" />
                    Pago Completo
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-white">
                    {metrics.fullPaymentsDeclared}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="flex items-center gap-2 text-[#E5E5E5]">
                    <span className="w-3 h-3 rounded-sm bg-[#525252]" />
                    Pago Parcial
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-white">
                    {metrics.partialPaymentsDeclared}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#292929] text-xs text-[#888888] tabular-nums">
                  Verificados admin: {metrics.verifiedPayments} · Pendientes:{' '}
                  {metrics.pendingVerificationPayments}
                </div>
              </div>
            </>
          )}
        </div>
      </DashboardCard>
    </div>
  );
}
