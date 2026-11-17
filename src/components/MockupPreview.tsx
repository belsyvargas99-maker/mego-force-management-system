import React from 'react';
import type { Contract } from '../types/mego';
import { ImageGallery } from './ImageGallery';
import { RegistrationForm } from './RegistrationForm';

interface MockupPreviewProps {
  contract: Pick<
    Contract,
    | 'contractId'
    | 'contractCode'
    | 'organizationName'
    | 'title'
    | 'description'
    | 'garmentType'
    | 'garmentFeatures'
    | 'additionalGarments'
    | 'currency'
    | 'unitPrice'
    | 'status'
    | 'publicToken'
    | 'availableSizes'
    | 'mockupImages'
    | 'formConfig'
  >;
}

export function MockupPreview({ contract }: MockupPreviewProps) {
  return (
    <div className="bg-[#080808] border border-[#292929] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-[#141414] border-b border-[#292929] flex items-center justify-between text-xs text-[#888888]">
        <span>Vista Previa del Enlace Público</span>
        <span className="font-mono text-white">/registro/{contract.publicToken || 'preview'}</span>
      </div>

      <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#ED1010] font-semibold">
              {contract.organizationName || 'Organización'}
            </p>
            <h3 className="font-display text-2xl uppercase tracking-wide text-white mt-1">
              {contract.title || 'Nombre del Contrato'}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-xs font-semibold text-white bg-[#141414] border border-[#292929] px-2.5 py-1 rounded">
                Prenda oficial: {contract.garmentType || 'Sin definir'}
              </span>
              {typeof contract.unitPrice === 'number' && contract.unitPrice > 0 && (
                <span className="text-xs font-mono text-[#4ADE80] bg-[#141414] border border-[#292929] px-2 py-1 rounded">
                  {contract.currency || 'USD'} {contract.unitPrice.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <ImageGallery images={contract.mockupImages || []} />

          {contract.description && (
            <p className="text-sm text-[#CCCCCC] leading-relaxed">{contract.description}</p>
          )}

          {contract.garmentFeatures && contract.garmentFeatures.length > 0 && (
            <ul className="space-y-1 text-xs text-[#B5B5B5] border-t border-[#222222] pt-3">
              {contract.garmentFeatures.map((feat, idx) => (
                <li key={idx}>• {feat}</li>
              ))}
            </ul>
          )}

          {contract.additionalGarments && contract.additionalGarments.length > 0 && (
            <p className="text-xs text-[#888888]">
              Prendas adicionales: <span className="text-white">{contract.additionalGarments.join(', ')}</span>
            </p>
          )}
        </div>

        <div className="lg:col-span-7 bg-[#141414] border border-[#292929] rounded-lg p-5 space-y-4">
          <div className="border-b border-[#292929] pb-3">
            <h4 className="font-display text-xl uppercase text-white">
              {contract.formConfig.title}
            </h4>
            <p className="text-xs text-[#888888] mt-1">{contract.formConfig.subtitle}</p>
          </div>

          <RegistrationForm
            contract={{
              contractId: contract.contractId || 'preview',
              publicToken: contract.publicToken || 'preview_token',
              status: 'active',
              availableSizes: contract.availableSizes,
              formConfig: contract.formConfig,
            }}
            previewMode
          />
        </div>
      </div>
    </div>
  );
}
