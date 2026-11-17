/**
 * MÓDULO 5: ARQUITECTURA EXTENSIBLE DE CRECIMIENTO MEGO FORCE
 *
 * Registro modular de dominios preparados para futuras fases operativas:
 * - Inventario de prendas terminadas
 * - Inventario de materiales e insumos (telas Dry-Tech, tintas, hilos)
 * - Gestión de proveedores
 * - Seguimiento de fabricación por estación (corte, sublimación, confección, control calidad)
 * - Gestión de entregas y despachos
 * - Control de almacén y ubicaciones
 * - Gestión financiera (cuentas por cobrar, abonos y márgenes por contrato)
 * - Historial consolidado de organizaciones
 * - Categorías de prendas (jerseys, shorts, chaquetas, kits ciclismo/running)
 * - Colecciones y temporadas
 */

export type FutureModuleKey =
  | 'garment_inventory'
  | 'materials_inventory'
  | 'suppliers'
  | 'manufacturing_tracking'
  | 'delivery_management'
  | 'warehouse_control'
  | 'financial_management'
  | 'organization_history'
  | 'garment_categories'
  | 'collections';

export interface ExtensibleDomainBlueprint {
  key: FutureModuleKey;
  title: string;
  collectionPath: string;
  dependsOn: ('contracts' | 'registrations' | 'productionOrders')[];
  enabled: false;
}

export interface GarmentCategoryRecord {
  categoryId: string;
  name: string;
  code: string;
  defaultSizes: string[];
  baseProductionDays: number;
  active: boolean;
}

export interface CollectionRecord {
  collectionId: string;
  name: string;
  seasonYear: number;
  garmentCategoryIds: string[];
  active: boolean;
}

export interface MaterialInventoryItem {
  materialId: string;
  sku: string;
  name: string;
  unit: 'meters' | 'kg' | 'units' | 'liters';
  stockOnHand: number;
  reorderPoint: number;
  supplierId: string;
}

export interface GarmentInventoryRecord {
  sku: string;
  categoryId: string;
  size: string;
  warehouseLocationId: string;
  availableUnits: number;
  reservedUnits: number;
}

export interface SupplierRecord {
  supplierId: string;
  name: string;
  contactEmail: string;
  leadTimeDays: number;
}

export interface ManufacturingStageEvent {
  eventId: string;
  orderId: string;
  stage: 'cutting' | 'sublimation' | 'sewing' | 'quality_check' | 'packing';
  operatorUid: string;
  completedAt: string;
}

export interface DeliveryBatchRecord {
  deliveryId: string;
  orderId: string;
  contractId: string;
  organizationName: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  carrierOrRecipient: string;
}

export interface FinancialLedgerEntry {
  entryId: string;
  contractId: string;
  registrationId?: string;
  type: 'receivable' | 'payment_verified' | 'production_cost';
  amount: number;
  currency: string;
  recordedAt: string;
}

export const FUTURE_DOMAIN_REGISTRY: Record<FutureModuleKey, ExtensibleDomainBlueprint> = {
  garment_inventory: {
    key: 'garment_inventory',
    title: 'Inventario de Prendas',
    collectionPath: 'garmentInventory',
    dependsOn: ['productionOrders'],
    enabled: false,
  },
  materials_inventory: {
    key: 'materials_inventory',
    title: 'Inventario de Materiales',
    collectionPath: 'materialsInventory',
    dependsOn: ['productionOrders'],
    enabled: false,
  },
  suppliers: {
    key: 'suppliers',
    title: 'Gestión de Proveedores',
    collectionPath: 'suppliers',
    dependsOn: ['productionOrders'],
    enabled: false,
  },
  manufacturing_tracking: {
    key: 'manufacturing_tracking',
    title: 'Seguimiento de Fabricación',
    collectionPath: 'manufacturingEvents',
    dependsOn: ['productionOrders'],
    enabled: false,
  },
  delivery_management: {
    key: 'delivery_management',
    title: 'Gestión de Entregas',
    collectionPath: 'deliveries',
    dependsOn: ['contracts', 'productionOrders'],
    enabled: false,
  },
  warehouse_control: {
    key: 'warehouse_control',
    title: 'Control de Almacén',
    collectionPath: 'warehouses',
    dependsOn: ['productionOrders'],
    enabled: false,
  },
  financial_management: {
    key: 'financial_management',
    title: 'Gestión Financiera',
    collectionPath: 'financialLedger',
    dependsOn: ['contracts', 'registrations'],
    enabled: false,
  },
  organization_history: {
    key: 'organization_history',
    title: 'Historial de Organizaciones',
    collectionPath: 'organizations',
    dependsOn: ['contracts', 'registrations'],
    enabled: false,
  },
  garment_categories: {
    key: 'garment_categories',
    title: 'Categorías de Prendas',
    collectionPath: 'garmentCategories',
    dependsOn: ['contracts'],
    enabled: false,
  },
  collections: {
    key: 'collections',
    title: 'Colecciones',
    collectionPath: 'collections',
    dependsOn: ['contracts'],
    enabled: false,
  },
};
