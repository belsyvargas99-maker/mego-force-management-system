import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  FileSpreadsheet,
  Shirt,
  ShieldCheck,
  Send,
  Workflow,
  Mail,
  Phone,
  MessageCircle,
  ArrowRight,
  CheckCircle2,
  Factory,
  CalendarClock,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { DashboardCard } from '../components/DashboardCard';
import { useAdminData } from '../hooks/useAdminData';
import { BOOTSTRAP_ADMIN_EMAIL } from '../services/settingsService';

const METHODOLOGY_STEPS = [
  {
    step: '01',
    title: 'Alta del Contrato y Nombre Oficial de Prenda',
    desc: 'Crea el contrato con código único, organización, precio/moneda y el nombre oficial de la prenda editable. El sistema genera tokens públicos separados para registro individual y masivo.',
  },
  {
    step: '02',
    title: 'Edición de Presentación y Mockups (Pre-Envío)',
    desc: 'Desde Presentación y Mockups ajusta el nombre oficial de la prenda, especificaciones técnicas, prendas adicionales y galería de imágenes con vista previa exacta antes de enviar cualquier enlace.',
  },
  {
    step: '03',
    title: 'Configuración de Modalidades y Enlaces Personalizados',
    desc: 'Activa Solo Individual, Solo Masivo o Ambos Portales desde CONFIGURACIÓN DE REGISTROS. Copia o envía el enlace directo por WhatsApp/Correo con fecha de expiración y revocación inmediata.',
  },
  {
    step: '04',
    title: 'Captura Atómica y Validación de Tallas',
    desc: 'Cada participante o representante de organización registra tallas y personalizaciones. Firestore bloquea cédulas duplicadas por contrato mediante locks atómicos sin exponer datos a terceros.',
  },
  {
    step: '05',
    title: 'Cierre Automático Programado y Verificación de Pagos',
    desc: 'El servidor valida apertura/cierre por zona horaria en cada envío. Administración audita pagos completos o parciales manteniendo separación estricta entre declaración y verificación.',
  },
  {
    step: '06',
    title: 'Automatización Excel & Google Sheets',
    desc: 'Los listados se importan con mapeo de columnas preservando ceros iniciales y se sincronizan hacia Google Sheets o Excel multi-pestaña (General cronológico, Tallas y Resumen).',
  },
  {
    step: '07',
    title: 'Órdenes de Producción Inmutables',
    desc: 'Al aprobar una orden en Producción MEGO FORCE, el snapshot de prendas y personalizaciones queda congelado y auditable, detectando automáticamente cualquier cambio posterior.',
  },
];

const GARMENT_EXAMPLES = [
  {
    context: 'Torneo de Fútbol / Baloncesto',
    before: 'Jersey Sublimado Pro',
    after: 'Jersey Oficial Torneo Apertura Dry-Tech 180g (Manga Corta)',
    impact:
      'Aparece en la portada pública del participante, encabezado del portal masivo, mensaje de WhatsApp, hoja RESUMEN de Excel y orden de corte.',
  },
  {
    context: 'Evento Corporativo o Running',
    before: 'Camiseta Deportiva',
    after: 'Franela Técnica Maratón 10K Microfibra UV+50',
    impact:
      'Asegura que el participante y la planta identifiquen exactamente la tela y versión aprobada para el lote.',
  },
  {
    context: 'Equipación Multi-Prenda',
    before: 'Kit Completo',
    after: 'Kit Competitivo Oficial (Jersey Elite + Short Pro)',
    impact:
      'Combinado con prendas adicionales en Presentación y Mockups permite registrar talla independiente por cada artículo.',
  },
];

export function AdminMethodologyPage() {
  const { settings, contracts } = useAdminData();
  const supportEmail = settings.contactEmail || BOOTSTRAP_ADMIN_EMAIL;
  const supportPhone = settings.contactPhone || '+1 800 555 0199';
  const cleanPhone = supportPhone.replace(/[^0-9]/g, '');

  return (
    <AdminLayout
      title="Metodología, Excel y Soporte"
      breadcrumb="Guía Interna de Operaciones, Automatización y Canal de Comunicación"
    >
      <div className="space-y-6">
        {/* Quick Internal Testing & Corporate Identity Strip */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <DashboardCard
            title="Acceso Administrativo Vinculado"
            subtitle="Seguridad RBAC basada en correo corporativo verificado"
            className="lg:col-span-6"
            action={<ShieldCheck className="w-5 h-5 text-[#ED1010]" />}
          >
            <div className="space-y-3 text-xs text-[#CCCCCC]">
              <div className="p-3 bg-[#0B0B0B] border border-[#222222] rounded space-y-1">
                <p className="text-[#888888]">Correo Oficial Principal (Super Admin):</p>
                <p className="font-mono text-sm text-[#4ADE80] font-semibold">
                  {BOOTSTRAP_ADMIN_EMAIL}
                </p>
              </div>
              <p className="leading-relaxed">
                El inicio de sesión administrativo utiliza Google Sign-In verificado y exige coincidencia exacta en{' '}
                <code className="text-white">authorizedAdmins</code> o con el correo principal en las reglas de Firestore. Puedes autorizar correos adicionales de la empresa desde{' '}
                <Link to="/admin/users" className="text-[#ED1010] hover:underline font-semibold">
                  Administradores
                </Link>
                .
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  to="/admin/mockups"
                  className="h-9 px-3.5 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded inline-flex items-center gap-1.5"
                >
                  <Shirt className="w-3.5 h-3.5" />
                  Editar Prenda y Presentación
                </Link>
                <Link
                  to="/admin/contracts"
                  className="h-9 px-3.5 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Ver Contratos ({contracts.length})
                </Link>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard
            title="Canal de Comunicación y Soporte Directo"
            subtitle="Atención para administradores, representantes de organización y clientes"
            className="lg:col-span-6"
            action={<MessageCircle className="w-5 h-5 text-[#4ADE80]" />}
          >
            <div className="space-y-3 text-xs text-[#CCCCCC]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-[#0B0B0B] border border-[#222222] rounded space-y-1">
                  <p className="text-[#888888]">Correo oficial de soporte</p>
                  <p className="font-mono text-white truncate">{supportEmail}</p>
                </div>
                <div className="p-3 bg-[#0B0B0B] border border-[#222222] rounded space-y-1">
                  <p className="text-[#888888]">WhatsApp / Teléfono operativo</p>
                  <p className="font-mono text-white">{supportPhone}</p>
                </div>
              </div>
              <p className="text-[#B5B5B5]">
                Este canal aparece también en los portales públicos para que participantes y coordinadores resuelvan dudas durante el registro.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={`mailto:${supportEmail}?subject=${encodeURIComponent(
                    'Consulta Operativa · MEGO FORCE Management System'
                  )}`}
                  className="h-9 px-3.5 bg-white hover:bg-neutral-200 text-[#080808] text-xs font-bold rounded inline-flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Escribir por Correo
                </a>
                {cleanPhone && (
                  <a
                    href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                      'Hola, tengo una consulta sobre MEGO FORCE Management System.'
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3.5 bg-[#16A34A]/20 hover:bg-[#16A34A]/30 border border-[#16A34A]/50 text-[#4ADE80] text-xs font-semibold rounded inline-flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Abrir WhatsApp Soporte
                  </a>
                )}
                <Link
                  to="/admin/settings"
                  className="h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs rounded inline-flex items-center gap-1.5"
                >
                  Configurar Canal
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </DashboardCard>
        </div>

        {/* Client Management Methodology */}
        <DashboardCard
          title="Metodología Oficial para la Gestión de Clientes (7 Fases)"
          subtitle="Proceso estandarizado desde la creación del contrato hasta la orden congelada en planta"
          action={<Workflow className="w-5 h-5 text-[#ED1010]" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {METHODOLOGY_STEPS.map((item) => (
              <div
                key={item.step}
                className="p-4 bg-[#0B0B0B] border border-[#222222] rounded-lg space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#ED1010]/15 border border-[#ED1010]/40 text-[#ED1010] font-mono text-xs font-bold rounded">
                    FASE {item.step}
                  </span>
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                </div>
                <p className="text-xs text-[#B5B5B5] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Garment Name Editing Examples */}
        <DashboardCard
          title="Ejemplos de Edición del Nombre Oficial de la Prenda"
          subtitle="Cómo personalizar el nombre antes de enviar los enlaces desde Presentación y Mockups o Editor de Contrato"
          action={<BookOpen className="w-5 h-5 text-[#ED1010]" />}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {GARMENT_EXAMPLES.map((ex, i) => (
              <div
                key={i}
                className="p-4 bg-[#0B0B0B] border border-[#292929] rounded-lg space-y-3 text-xs"
              >
                <p className="text-[11px] uppercase tracking-wider text-[#ED1010] font-semibold">
                  {ex.context}
                </p>
                <div className="space-y-1.5">
                  <div className="p-2 bg-[#141414] rounded border border-[#222222]">
                    <span className="text-[#888888] block">Nombre inicial borrador:</span>
                    <span className="text-[#B5B5B5] line-through">{ex.before}</span>
                  </div>
                  <div className="p-2 bg-[#141414] rounded border border-[#16A34A]/40">
                    <span className="text-[#4ADE80] block font-semibold">
                      Nombre oficial editado:
                    </span>
                    <span className="text-white font-semibold">{ex.after}</span>
                  </div>
                </div>
                <p className="text-[#B5B5B5] leading-relaxed flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80] shrink-0 mt-0.5" />
                  <span>{ex.impact}</span>
                </p>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Automation & Excel Integration */}
        <DashboardCard
          title="Automatización de Tareas e Integración con Excel y Google Sheets"
          subtitle="Arquitectura de importación, validación por lotes, exportación multi-hoja y sincronización en cola"
          action={<FileSpreadsheet className="w-5 h-5 text-[#4ADE80]" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-[#0B0B0B] border border-[#222222] rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <FileSpreadsheet className="w-4 h-4 text-[#4ADE80]" />
                <span>1. Importación Excel / CSV / Word</span>
              </div>
              <ul className="space-y-1.5 text-[#B5B5B5]">
                <li>• Soporta archivos <strong>.xlsx, .xls, .csv y .docx</strong> tanto en Importador Admin como en el Portal Masivo Público.</li>
                <li>• Selector de hoja del libro Excel y asistente de mapeo automático de columnas.</li>
                <li>• Preservación estricta de ceros iniciales en cédulas y teléfonos (`raw: false`).</li>
                <li>• Guardado por lotes de hasta 80 registros por bloque con clave de idempotencia anti-duplicados.</li>
              </ul>
            </div>

            <div className="p-4 bg-[#0B0B0B] border border-[#222222] rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Factory className="w-4 h-4 text-[#ED1010]" />
                <span>2. Exportación Excel Multi-Pestaña y PDF</span>
              </div>
              <ul className="space-y-1.5 text-[#B5B5B5]">
                <li>• <strong>TODOS LOS REGISTROS</strong>: listado cronológico con autofiltro y columnas autoajustadas.</li>
                <li>• <strong>Hojas por Talla (XS–XXXL)</strong>: separación automática lista para corte y sublimación.</li>
                <li>• <strong>RESUMEN PRODUCCIÓN</strong>: incluye contrato, prenda oficial editada, conteos y porcentajes.</li>
                <li>• En Órdenes de Producción: Excel de Producción + 3 PDFs (Producción, Por Tallas, Personalizaciones).</li>
              </ul>
            </div>

            <div className="p-4 bg-[#0B0B0B] border border-[#222222] rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <CalendarClock className="w-4 h-4 text-[#38BDF8]" />
                <span>3. Automatización en Cola y Ventanas</span>
              </div>
              <ul className="space-y-1.5 text-[#B5B5B5]">
                <li>• <strong>Google Sheets API</strong>: crea hojas independientes por contrato y sincroniza con reintentos en <code className="text-white">syncJobs</code>.</li>
                <li>• <strong>Cierre Automático</strong>: conciliación de fechas en servidor (`/api/contracts/reconcile-schedules`) y bloqueo de envíos vencidos con HTTP 403.</li>
                <li>• <strong>Auditoría Inmutable</strong>: cada edición de prenda, enlace o sincronización queda registrada en <code className="text-white">auditLogs</code>.</li>
              </ul>
            </div>
          </div>
        </DashboardCard>
      </div>
    </AdminLayout>
  );
}
