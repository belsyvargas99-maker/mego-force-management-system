export type ContractStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'auto_closed'
  | 'closed'
  | 'finished'
  | 'archived';

export type DynamicFieldType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'phone'
  | 'email'
  | 'select'
  | 'single_choice'
  | 'multi_checkbox'
  | 'date'
  | 'custom';

export type PaymentSelection = 'PAGO COMPLETO' | 'PAGO PARCIAL';
export type PaymentVerificationStatus = 'pending' | 'verified' | 'rejected';
export type RegistrationStatus = 'confirmed' | 'cancelled' | 'edited';
export type RegistrationMode = 'individual' | 'bulk';
export type RegistrationSource =
  | 'public_form'
  | 'bulk_representative'
  | 'admin_manual'
  | 'excel_import';
export type AdminRole = 'super_admin' | 'admin' | 'operator';
export type SyncJobStatus = 'pending' | 'synced' | 'error' | 'retrying';

export type ProductionOrderStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'in_production'
  | 'completed'
  | 'delivered';

export interface FormFieldConfig {
  id: string;
  key: string;
  label: string;
  type: DynamicFieldType;
  required: boolean;
  enabled: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  maxLength?: number;
  countryFormat?: string;
  isSystemDefault?: boolean;
  order: number;
}

export interface FormConfig {
  title: string;
  subtitle: string;
  instructions: string;
  submitButtonText: string;
  confirmationMessage: string;
  privacyPolicyText: string;
  requireReviewStep: boolean;
  fields: FormFieldConfig[];
}

export interface MockupImage {
  id: string;
  url: string;
  storagePath?: string;
  caption: string;
  isPrimary: boolean;
  order: number;
}

export interface SheetsSyncConfig {
  enabled: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  lastSyncAt?: string;
  lastSyncStatus?: SyncJobStatus;
  lastError?: string;
  autoRetry: boolean;
}

export interface ScheduleChangeEntry {
  changedAt: string;
  changedBy: string;
  action:
    | 'scheduled'
    | 'auto_opened'
    | 'auto_closed'
    | 'manual_closed'
    | 'manual_reopened'
    | 'deadline_extended'
    | 'status_changed';
  previousStatus: ContractStatus;
  newStatus: ContractStatus;
  previousWindow?: string;
  newWindow?: string;
  reason: string;
}

export interface Contract {
  contractId: string;
  contractCode: string;
  organizationName: string;
  title: string;
  description: string;
  garmentType: string;
  garmentFeatures: string[];
  status: ContractStatus;
  startDate?: string;
  endDate?: string;
  openDate?: string;
  openTime?: string;
  closeDate?: string;
  closeTime?: string;
  timezone?: string;
  closedMessage?: string;
  closedAt?: string;
  closeReason?: string;
  scheduleHistory?: ScheduleChangeEntry[];
  bulkRegistrationEnabled?: boolean;
  individualRegistrationEnabled?: boolean;
  individualLinkExpiresAt?: string;
  bulkLinkExpiresAt?: string;
  currency?: string;
  unitPrice?: number;
  additionalGarments?: string[];
  bulkToken?: string;
  publicToken: string;
  availableSizes: string[];
  mockupImages: MockupImage[];
  formConfig: FormConfig;
  sheetsConfig?: SheetsSyncConfig;
  totalParticipants: number;
  sizeCounts?: Record<string, number>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicContract {
  publicToken: string;
  contractId: string;
  contractCode: string;
  organizationName: string;
  title: string;
  description: string;
  garmentType: string;
  garmentFeatures: string[];
  status: ContractStatus;
  startDate?: string;
  endDate?: string;
  openDate?: string;
  openTime?: string;
  closeDate?: string;
  closeTime?: string;
  timezone?: string;
  closedMessage?: string;
  bulkRegistrationEnabled?: boolean;
  individualRegistrationEnabled?: boolean;
  individualLinkExpiresAt?: string;
  bulkLinkExpiresAt?: string;
  currency?: string;
  unitPrice?: number;
  additionalGarments?: string[];
  bulkToken?: string;
  availableSizes: string[];
  mockupImages: MockupImage[];
  formConfig: FormConfig;
  totalParticipants: number;
  sizeCounts?: Record<string, number>;
  updatedAt: string;
}

export interface PublicBulkContractLink {
  bulkToken: string;
  publicToken: string;
  contractId: string;
  enabled: boolean;
  updatedAt: string;
}

export interface Registration {
  registrationId: string;
  registrationCode: string;
  contractId: string;
  publicToken: string;
  fullName: string;
  identificationNumber: string;
  identificationHash: string;
  size: string;
  nickname: string;
  phone: string;
  instagram: string;
  paymentSelection: PaymentSelection;
  paymentVerificationStatus: PaymentVerificationStatus;
  paymentAmount?: number;
  paymentNotes?: string;
  customFields?: Record<string, string | string[] | boolean | number>;
  garmentItems?: { garment: string; size: string; nickname?: string }[];
  privacyAccepted: boolean;
  registrationTimestamp: string;
  registrationStatus: RegistrationStatus;
  registrationMode?: RegistrationMode;
  bulkSubmissionId?: string;
  representativeName?: string;
  source: RegistrationSource;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationLock {
  contractId: string;
  identificationHash: string;
  registrationId: string;
  registrationCode: string;
  maskedId: string;
  displayName: string;
  size: string;
  nickname: string;
  paymentSelection: PaymentSelection;
  paymentVerificationStatus: PaymentVerificationStatus;
  createdAt: string;
}

export interface BulkSubmissionRecord {
  submissionId: string;
  idempotencyKey: string;
  contractId: string;
  publicToken: string;
  bulkToken: string;
  representativeName: string;
  representativeContact: string;
  organizationName: string;
  totalEntered: number;
  totalValid: number;
  totalRejected: number;
  totalDuplicates?: number;
  totalSaved: number;
  pendingSyncCount: number;
  registrationCodes: string[];
  rejectedReasons: string[];
  status: 'processing' | 'completed' | 'partial';
  createdAt: string;
  updatedAt: string;
}

export interface ProductionOrderItem {
  registrationId: string;
  registrationCode: string;
  fullName: string;
  size: string;
  nickname: string;
  garmentType: string;
  customizationNotes: string;
  paymentSelection: PaymentSelection;
  paymentVerificationStatus: PaymentVerificationStatus;
  registrationMode: RegistrationMode;
}

export interface ProductionOrderVersionEntry {
  version: number;
  createdAt: string;
  createdByEmail: string;
  action: 'created' | 'approved' | 'new_version' | 'status_updated';
  changesSummary: string;
  totalGarments: number;
  snapshotHash: string;
}

export interface ProductionOrder {
  orderId: string;
  orderCode: string;
  contractId: string;
  contractCode: string;
  contractTitle: string;
  organizationName: string;
  garmentType: string;
  status: ProductionOrderStatus;
  version: number;
  isFrozen: boolean;
  totalGarments: number;
  availableSizes: string[];
  sizeSummary: Record<string, number>;
  snapshotItems: ProductionOrderItem[];
  observations: string;
  responsibleUid: string;
  responsibleName: string;
  approvedByEmail?: string;
  approvedAt?: string;
  versionHistory: ProductionOrderVersionEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface SyncJob {
  jobId: string;
  contractId: string;
  registrationId?: string;
  destination: 'google_sheets';
  status: SyncJobStatus;
  attempts: number;
  lastAttemptAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface AuditLog {
  logId: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType:
    | 'contract'
    | 'registration'
    | 'payment'
    | 'form'
    | 'settings'
    | 'user'
    | 'sync'
    | 'import'
    | 'bulk_submission'
    | 'production_order'
    | 'schedule';
  entityId: string;
  changedFields: AuditChange[];
  createdAt: string;
}

export interface AuthorizedAdmin {
  email: string;
  role: AdminRole;
  active: boolean;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: AdminRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalSettings {
  brandName: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  displayFont?: string;
  bodyFont?: string;
  contactEmail?: string;
  contactPhone?: string;
  defaultSizes: string[];
  dateFormat?: string;
  timezone?: string;
  privacyPolicyText: string;
  defaultConfirmationMessage?: string;
  updatedAt: string;
}

export interface SizeGroup {
  size: string;
  count: number;
  percentage: number;
  registrations: Registration[];
}

export interface ProductionSummary {
  totalGarments: number;
  pendingVerifications: number;
  verifiedPayments: number;
  rejectedPayments: number;
  fullPaymentsDeclared: number;
  partialPaymentsDeclared: number;
  customNicknamesCount: number;
  groups: SizeGroup[];
}

export interface DashboardMetrics {
  activeContracts: number;
  totalContracts: number;
  totalParticipants: number;
  totalGarments: number;
  fullPaymentsDeclared: number;
  partialPaymentsDeclared: number;
  verifiedPayments: number;
  pendingVerificationPayments: number;
  rejectedPayments: number;
  bySize: { size: string; count: number; percentage: number }[];
  byDate: { date: string; count: number }[];
  byContract: { contractId: string; title: string; count: number }[];
  byPaymentModality: { name: string; value: number }[];
}
