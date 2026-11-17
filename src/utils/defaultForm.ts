import type { FormConfig, FormFieldConfig, GlobalSettings } from '../types/mego';

export const DEFAULT_AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export const DEFAULT_PRIVACY_POLICY_TEXT =
  'Autorizo a MEGO FORCE el tratamiento de mis datos personales exclusivamente para la gestión de producción, personalización, tallaje y coordinación de entrega del uniforme correspondiente a este contrato.';

export const DEFAULT_FORM_FIELDS: FormFieldConfig[] = [
  {
    id: 'field_fullName',
    key: 'fullName',
    label: 'NOMBRE Y APELLIDO',
    type: 'short_text',
    required: true,
    enabled: true,
    placeholder: 'Ej. Carlos Andrés Mendoza',
    helpText: 'Ingresa tu nombre y apellido completos tal como aparecerán en el listado oficial.',
    maxLength: 160,
    isSystemDefault: true,
    order: 1,
  },
  {
    id: 'field_identificationNumber',
    key: 'identificationNumber',
    label: 'CÉDULA',
    type: 'short_text',
    required: true,
    enabled: true,
    placeholder: 'Ej. 0012345678',
    helpText: 'Conserva los ceros iniciales. Se permite un solo registro por cédula en este contrato.',
    maxLength: 30,
    countryFormat: 'GENERAL',
    isSystemDefault: true,
    order: 2,
  },
  {
    id: 'field_size',
    key: 'size',
    label: 'TALLA',
    type: 'single_choice',
    required: true,
    enabled: true,
    helpText: 'Selecciona tu talla exacta. Consulta la guía de medidas antes de confirmar.',
    options: [...DEFAULT_AVAILABLE_SIZES],
    isSystemDefault: true,
    order: 3,
  },
  {
    id: 'field_nickname',
    key: 'nickname',
    label: 'SEUDÓNIMO',
    type: 'short_text',
    required: true,
    enabled: true,
    placeholder: 'Ej. MENDOZA 10',
    helpText: 'Texto que se estampará en la prenda personalizada.',
    maxLength: 18,
    isSystemDefault: true,
    order: 4,
  },
  {
    id: 'field_phone',
    key: 'phone',
    label: 'NÚMERO DE TELÉFONO',
    type: 'phone',
    required: true,
    enabled: true,
    placeholder: 'Ej. +58 412 0987654',
    helpText: 'Incluye el prefijo internacional o código de área.',
    maxLength: 30,
    isSystemDefault: true,
    order: 5,
  },
  {
    id: 'field_instagram',
    key: 'instagram',
    label: 'INSTAGRAM',
    type: 'short_text',
    required: false,
    enabled: true,
    placeholder: 'Ej. @usuario_deportivo',
    helpText: 'Opcional. Puedes escribirlo con o sin @.',
    maxLength: 60,
    isSystemDefault: true,
    order: 6,
  },
  {
    id: 'field_paymentSelection',
    key: 'paymentSelection',
    label: 'MODALIDAD DE PAGO',
    type: 'single_choice',
    required: true,
    enabled: true,
    helpText: 'Selecciona una sola modalidad. El pago será verificado por administración.',
    options: ['PAGO COMPLETO', 'PAGO PARCIAL'],
    isSystemDefault: true,
    order: 7,
  },
];

export function createDefaultFormConfig(
  title = 'Registro Oficial de Uniforme',
  subtitle = 'Completa tus datos para confirmar tu talla y personalización',
  instructions = 'Verifica cuidadosamente tu talla y seudónimo antes de enviar. Solo se admite un registro por número de cédula.'
): FormConfig {
  return {
    title,
    subtitle,
    instructions,
    submitButtonText: 'Confirmar Registro',
    confirmationMessage:
      'Tu registro ha sido confirmado y asignado a la orden de producción de MEGO FORCE. Guarda tu código de confirmación.',
    privacyPolicyText: DEFAULT_PRIVACY_POLICY_TEXT,
    requireReviewStep: true,
    fields: DEFAULT_FORM_FIELDS.map((f) => ({
      ...f,
      options: f.options ? [...f.options] : undefined,
    })),
  };
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  brandName: 'MEGO FORCE',
  logoUrl: '',
  primaryColor: '#080808',
  accentColor: '#ED1010',
  displayFont: 'Oswald',
  bodyFont: 'DM Sans',
  contactEmail: 'belsyvargas99@gmail.com',
  contactPhone: '',
  defaultSizes: [...DEFAULT_AVAILABLE_SIZES],
  dateFormat: 'dd/MM/yyyy HH:mm',
  timezone: 'America/Caracas',
  privacyPolicyText: DEFAULT_PRIVACY_POLICY_TEXT,
  defaultConfirmationMessage:
    'Registro guardado correctamente en la cola de producción de MEGO FORCE.',
  updatedAt: new Date().toISOString(),
};
