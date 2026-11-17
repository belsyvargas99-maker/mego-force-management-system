import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { Contract, ProductionOrder, Registration } from '../types/mego';
import { PRODUCTION_ORDER_STATUS_META } from '../utils/productionOrders';
import {
  calculateProductionSummary,
  groupRegistrationsBySize,
  sortRegistrationsChronologically,
} from '../utils/sizeEngine';

export interface ExportOptions {
  scope: 'all' | 'filtered' | 'size' | 'production_summary';
  specificSize?: string;
}

function formatDateTime(iso: string): { date: string; time: string } {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return { date: '-', time: '-' };
  return {
    date: format(dt, 'dd/MM/yyyy'),
    time: format(dt, 'HH:mm:ss'),
  };
}

function buildRows(list: Registration[]) {
  return sortRegistrationsChronologically(list).map((reg, idx) => {
    const { date, time } = formatDateTime(reg.registrationTimestamp || reg.createdAt);
    const verif =
      reg.paymentVerificationStatus === 'verified'
        ? 'VERIFICADO'
        : reg.paymentVerificationStatus === 'rejected'
          ? 'RECHAZADO'
          : 'PENDIENTE';
    return {
      Número: idx + 1,
      'Nombre y Apellido': reg.fullName,
      Cédula: reg.identificationNumber,
      Talla: reg.size,
      Seudónimo: reg.nickname || '-',
      Teléfono: reg.phone,
      Instagram: reg.instagram || '-',
      'Modalidad de Pago': reg.paymentSelection,
      'Verificación Admin': verif,
      Fecha: date,
      Hora: time,
      'Código Registro': reg.registrationCode,
    };
  });
}

function autoFitColumns(rows: Record<string, unknown>[], minWidth = 12) {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => {
    const maxLen = Math.max(
      key.length + 2,
      ...rows.map((r) => String(r[key] ?? '').length + 2)
    );
    return { wch: Math.min(Math.max(maxLen, minWidth), 40) };
  });
}

export function exportContractToExcel(
  contract: Pick<
    Contract,
    'contractCode' | 'title' | 'organizationName' | 'availableSizes'
  > & { garmentType?: string },
  registrations: Registration[],
  options: ExportOptions = { scope: 'all' }
): void {
  const wb = XLSX.utils.book_new();
  const sizes = contract.availableSizes?.length
    ? contract.availableSizes
    : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  let targetRegs = sortRegistrationsChronologically(
    registrations.filter((r) => r.registrationStatus !== 'cancelled')
  );

  if (options.scope === 'size' && options.specificSize) {
    targetRegs = targetRegs.filter((r) => r.size === options.specificSize);
  }

  // 1. General Chronological Sheet
  if (options.scope !== 'production_summary') {
    const generalRows = buildRows(targetRegs);
    const wsGeneral = XLSX.utils.json_to_sheet(
      generalRows.length > 0
        ? generalRows
        : [{ Mensaje: 'No hay registros para los filtros seleccionados.' }]
    );
    wsGeneral['!cols'] = autoFitColumns(generalRows);
    if (generalRows.length > 0) {
      wsGeneral['!autofilter'] = { ref: `A1:L${generalRows.length + 1}` };
    }
    XLSX.utils.book_append_sheet(wb, wsGeneral, 'TODOS LOS REGISTROS');

    // 2. Individual Size Sheets
    const groups = groupRegistrationsBySize(targetRegs, sizes);
    for (const group of groups) {
      if (options.scope === 'size' && group.size !== options.specificSize) continue;
      if (group.count === 0 && !sizes.includes(group.size)) continue;
      const sizeRows = buildRows(group.registrations);
      const wsSize = XLSX.utils.json_to_sheet(
        sizeRows.length > 0
          ? sizeRows
          : [{ Mensaje: `Sin participantes en talla ${group.size}` }]
      );
      wsSize['!cols'] = autoFitColumns(sizeRows);
      if (sizeRows.length > 0) {
        wsSize['!autofilter'] = { ref: `A1:L${sizeRows.length + 1}` };
      }
      XLSX.utils.book_append_sheet(wb, wsSize, group.size.slice(0, 31));
    }
  }

  // 3. Production Summary Sheet
  const summary = calculateProductionSummary(targetRegs, sizes);
  const summaryMatrix = [
    ['MEGO FORCE · RESUMEN DE PRODUCCIÓN', contract.contractCode],
    ['Contrato', contract.title],
    ['Organización', contract.organizationName],
    ['Prenda Oficial', contract.garmentType || '-'],
    ['Fecha de Generación', format(new Date(), 'dd/MM/yyyy HH:mm')],
    ['Total Prendas a Fabricar', summary.totalGarments],
    ['Pagos Completos Declarados', summary.fullPaymentsDeclared],
    ['Pagos Parciales Declarados', summary.partialPaymentsDeclared],
    ['Pagos Verificados Admin', summary.verifiedPayments],
    ['Pagos Pendientes Verificación', summary.pendingVerifications],
    [],
    ['TALLA', 'CANTIDAD', 'PORCENTAJE (%)'],
    ...summary.groups.map((g) => [g.size, g.count, `${g.percentage}%`]),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryMatrix);
  wsSummary['!cols'] = [{ wch: 34 }, { wch: 24 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'RESUMEN PRODUCCIÓN');

  const suffix =
    options.scope === 'size' && options.specificSize
      ? `_${options.specificSize}`
      : options.scope === 'production_summary'
        ? '_RESUMEN'
        : '';
  const fileName = `MEGO_FORCE_${contract.contractCode}${suffix}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportContractToPdf(
  contract: Pick<Contract, 'contractCode' | 'title' | 'organizationName' | 'availableSizes'>,
  registrations: Registration[],
  options: ExportOptions = { scope: 'all' }
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const sizes = contract.availableSizes?.length
    ? contract.availableSizes
    : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  let targetRegs = sortRegistrationsChronologically(
    registrations.filter((r) => r.registrationStatus !== 'cancelled')
  );
  if (options.scope === 'size' && options.specificSize) {
    targetRegs = targetRegs.filter((r) => r.size === options.specificSize);
  }

  const summary = calculateProductionSummary(targetRegs, sizes);
  const generatedStr = format(new Date(), 'dd/MM/yyyy HH:mm');

  // Header Banner
  doc.setFillColor(8, 8, 8);
  doc.rect(0, 0, 297, 26, 'F');
  doc.setFillColor(237, 16, 16);
  doc.rect(0, 24, 297, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('MEGO FORCE', 14, 12);

  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(`${contract.contractCode} · ${contract.title}`, 14, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Organización: ${contract.organizationName}`, 180, 11);
  doc.text(`Generado: ${generatedStr} · Participantes: ${summary.totalGarments}`, 180, 18);

  // Size Summary Table
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RESUMEN DE PRODUCCIÓN POR TALLA', 14, 35);

  autoTable(doc, {
    startY: 38,
    head: [['Talla', ...summary.groups.map((g) => g.size), 'TOTAL']],
    body: [
      ['Cantidad', ...summary.groups.map((g) => String(g.count)), String(summary.totalGarments)],
      ['Distribución', ...summary.groups.map((g) => `${g.percentage}%`), '100%'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [41, 41, 41], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8, halign: 'center' },
    margin: { left: 14, right: 14 },
  });

  if (options.scope !== 'production_summary') {
    const groups = groupRegistrationsBySize(targetRegs, sizes).filter((g) => g.count > 0);

    for (const grp of groups) {
      const lastY = (doc as any).lastAutoTable?.finalY || 60;
      if (lastY > 165) {
        doc.addPage();
      }
      const startY = ((doc as any).lastAutoTable?.finalY || 30) + 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(237, 16, 16);
      doc.text(`TALLA ${grp.size} — ${grp.count} PRENDA(S)`, 14, startY);

      autoTable(doc, {
        startY: startY + 2,
        head: [[
          '#',
          'Nombre Completo',
          'Cédula',
          'Talla',
          'Seudónimo',
          'Teléfono',
          'Instagram',
          'Pago Declarado',
          'Verificación',
          'Fecha',
        ]],
        body: grp.registrations.map((r, i) => {
          const { date } = formatDateTime(r.registrationTimestamp || r.createdAt);
          return [
            String(i + 1),
            r.fullName,
            r.identificationNumber,
            r.size,
            r.nickname || '-',
            r.phone,
            r.instagram || '-',
            r.paymentSelection,
            r.paymentVerificationStatus.toUpperCase(),
            date,
          ];
        }),
        theme: 'striped',
        headStyles: { fillColor: [8, 8, 8], textColor: [255, 255, 255], fontSize: 7.5 },
        bodyStyles: { fontSize: 7.5 },
        margin: { left: 14, right: 14 },
      });
    }
  }

  // Page numbering
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `MEGO FORCE Management System · Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  const suffix =
    options.scope === 'size' && options.specificSize ? `_${options.specificSize}` : '';
  doc.save(`MEGO_FORCE_${contract.contractCode}${suffix}_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

export function exportProductionOrderExcel(order: ProductionOrder): void {
  const wb = XLSX.utils.book_new();
  const statusLabel = PRODUCTION_ORDER_STATUS_META[order.status]?.label || order.status;

  // 1. Order Summary & Size Matrix
  const sizes = order.availableSizes?.length
    ? order.availableSizes
    : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const summaryRows = [
    ['MEGO FORCE · ORDEN DE FABRICACIÓN', order.orderCode],
    ['Versión', `v${order.version} ${order.isFrozen ? '(APROBADA / INMUTABLE)' : '(EN PROCESO)'}`],
    ['Estado', statusLabel],
    ['Contrato', `${order.contractCode} · ${order.contractTitle}`],
    ['Organización', order.organizationName],
    ['Tipo de prenda', order.garmentType],
    ['Responsable', order.responsibleName],
    ['Aprobado por', order.approvedByEmail || 'Pendiente de aprobación'],
    ['Fecha de aprobación', order.approvedAt ? formatDateTime(order.approvedAt).date : '-'],
    ['Total de prendas', order.totalGarments],
    ['Observaciones', order.observations || 'Sin observaciones'],
    [],
    ['DISTRIBUCIÓN POR TALLAS', 'CANTIDAD', 'PORCENTAJE'],
    ...sizes.map((sz) => {
      const qty = order.sizeSummary[sz] || 0;
      const pct = order.totalGarments > 0 ? Math.round((qty / order.totalGarments) * 100) : 0;
      return [sz, qty, `${pct}%`];
    }),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 40 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'ORDEN RESUMEN');

  // 2. Individual Customizations Sheet
  const itemRows = order.snapshotItems.map((it, idx) => ({
    '#': idx + 1,
    Código: it.registrationCode,
    Participante: it.fullName,
    Talla: it.size,
    Seudónimo: it.nickname || '-',
    Prenda: it.garmentType,
    Personalización: it.customizationNotes,
    'Tipo Registro': it.registrationMode === 'bulk' ? 'MASIVO' : 'INDIVIDUAL',
    Pago: it.paymentSelection,
    'Verificación Pago': it.paymentVerificationStatus.toUpperCase(),
  }));
  const wsItems = XLSX.utils.json_to_sheet(
    itemRows.length > 0 ? itemRows : [{ Mensaje: 'Sin prendas en esta orden.' }]
  );
  wsItems['!cols'] = autoFitColumns(itemRows);
  if (itemRows.length > 0) {
    wsItems['!autofilter'] = { ref: `A1:J${itemRows.length + 1}` };
  }
  XLSX.utils.book_append_sheet(wb, wsItems, 'LISTADO PERSONALIZACIONES');

  // 3. Per-size sheets for production floor
  for (const sz of sizes) {
    const bySz = itemRows.filter((r) => r.Talla === sz);
    if (bySz.length === 0) continue;
    const wsSz = XLSX.utils.json_to_sheet(bySz);
    wsSz['!cols'] = autoFitColumns(bySz);
    XLSX.utils.book_append_sheet(wb, wsSz, `TALLA ${sz}`.slice(0, 31));
  }

  XLSX.writeFile(wb, `ORDEN_${order.orderCode}_v${order.version}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

export function exportProductionOrderPdf(
  order: ProductionOrder,
  mode: 'full' | 'by_size' | 'customizations' = 'full'
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const sizes = order.availableSizes?.length
    ? order.availableSizes
    : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const statusLabel = PRODUCTION_ORDER_STATUS_META[order.status]?.label || order.status;

  // Header
  doc.setFillColor(8, 8, 8);
  doc.rect(0, 0, 297, 28, 'F');
  doc.setFillColor(237, 16, 16);
  doc.rect(0, 26, 297, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('PRODUCCIÓN MEGO FORCE · ORDEN DE FABRICACIÓN', 14, 12);

  doc.setFontSize(10);
  doc.setTextColor(220, 220, 220);
  doc.text(
    `${order.orderCode} · Versión v${order.version} · ${statusLabel.toUpperCase()}${order.isFrozen ? ' · CONGELADA' : ''}`,
    14,
    19.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Contrato: ${order.contractCode} · ${order.organizationName}`, 185, 11);
  doc.text(`Responsable: ${order.responsibleName} · Total Prendas: ${order.totalGarments}`, 185, 17);
  doc.text(`Generada: ${formatDateTime(order.createdAt).date}`, 185, 22.5);

  let currentY = 35;
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`PRENDA: ${order.garmentType}  |  CONTRATO: ${order.contractTitle}`, 14, currentY);

  if (order.observations) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(`Observaciones: ${order.observations.slice(0, 140)}`, 14, currentY + 5.5);
    currentY += 7;
  }

  // Size Matrix always at top
  autoTable(doc, {
    startY: currentY + 4,
    head: [['TALLA', ...sizes, 'TOTAL PRENDAS']],
    body: [
      ['CANTIDAD', ...sizes.map((s) => String(order.sizeSummary[s] || 0)), String(order.totalGarments)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [41, 41, 41], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8.5, halign: 'center', fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
  });

  if (mode === 'by_size') {
    for (const sz of sizes) {
      const list = order.snapshotItems.filter((it) => it.size === sz);
      if (list.length === 0) continue;
      const prevY = (doc as any).lastAutoTable?.finalY || 70;
      if (prevY > 160) doc.addPage();
      const startY = ((doc as any).lastAutoTable?.finalY || 30) + 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(237, 16, 16);
      doc.text(`TALLA ${sz} — ${list.length} PRENDA(S)`, 14, startY);

      autoTable(doc, {
        startY: startY + 2.5,
        head: [['#', 'Participante', 'Talla', 'Seudónimo', 'Tipo de Prenda', 'Observaciones de Personalización']],
        body: list.map((it, idx) => [
          String(idx + 1),
          it.fullName,
          it.size,
          it.nickname || '-',
          it.garmentType,
          it.customizationNotes,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [8, 8, 8], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
    }
  } else {
    // 'full' or 'customizations'
    const startY = ((doc as any).lastAutoTable?.finalY || 65) + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text(
      mode === 'customizations'
        ? 'LISTADO INDIVIDUAL DE PERSONALIZACIONES'
        : 'DETALLE GENERAL DE FABRICACIÓN POR PARTICIPANTE',
      14,
      startY
    );

    autoTable(doc, {
      startY: startY + 3,
      head: [
        mode === 'customizations'
          ? ['#', 'Participante', 'Talla', 'Seudónimo', 'Prenda', 'Observaciones de Personalización']
          : ['#', 'Código', 'Participante', 'Talla', 'Seudónimo', 'Prenda', 'Personalización', 'Registro'],
      ],
      body: order.snapshotItems.map((it, idx) =>
        mode === 'customizations'
          ? [
              String(idx + 1),
              it.fullName,
              it.size,
              it.nickname || '-',
              it.garmentType,
              it.customizationNotes,
            ]
          : [
              String(idx + 1),
              it.registrationCode,
              it.fullName,
              it.size,
              it.nickname || '-',
              it.garmentType,
              it.customizationNotes,
              it.registrationMode === 'bulk' ? 'MASIVO' : 'INDIVIDUAL',
            ]
      ),
      theme: 'striped',
      headStyles: { fillColor: [8, 8, 8], textColor: [255, 255, 255], fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: 14, right: 14 },
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `PRODUCCIÓN MEGO FORCE · ${order.orderCode} (v${order.version}) · Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  const suffix =
    mode === 'by_size'
      ? '_POR_TALLAS'
      : mode === 'customizations'
        ? '_PERSONALIZACIONES'
        : '_PRODUCCION';
  doc.save(`ORDEN_${order.orderCode}${suffix}_v${order.version}.pdf`);
}

