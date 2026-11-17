import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadMockupImage } from '../services/mockupsService';
import type { MockupImage } from '../types/mego';

interface ImageUploaderProps {
  contractId: string;
  currentCount: number;
  onUploaded: (images: MockupImage[]) => void;
}

export function ImageUploader({
  contractId,
  currentCount,
  onUploaded,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      setUploading(true);
      try {
        const uploaded: MockupImage[] = [];
        for (let i = 0; i < acceptedFiles.length; i++) {
          const img = await uploadMockupImage(
            acceptedFiles[i],
            contractId,
            currentCount + i,
            currentCount === 0 && i === 0
          );
          uploaded.push(img);
        }
        onUploaded(uploaded);
        toast.success(
          uploaded.length === 1
            ? 'Mockup subido correctamente.'
            : `${uploaded.length} mockups subidos correctamente.`
        );
      } catch (err: any) {
        toast.error(err?.message || 'Error al subir imágenes.');
      } finally {
        setUploading(false);
      }
    },
    [contractId, currentCount, onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/svg+xml': ['.svg'],
    },
    maxSize: 5 * 1024 * 1024,
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        isDragActive
          ? 'border-[#ED1010] bg-[#ED1010]/10'
          : 'border-[#292929] bg-[#0F0F0F] hover:border-[#525252]'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-2">
        {uploading ? (
          <Loader2 className="w-8 h-8 text-[#ED1010] animate-spin" />
        ) : (
          <UploadCloud className="w-8 h-8 text-[#888888]" />
        )}
        <p className="text-sm font-medium text-white">
          {uploading
            ? 'Subiendo mockups...'
            : isDragActive
              ? 'Suelta las imágenes aquí'
              : 'Arrastra mockups del uniforme o haz clic para seleccionar'}
        </p>
        <p className="text-xs text-[#888888]">
          PNG, JPG, WEBP o SVG · Máximo 5 MB por archivo · Varias imágenes permitidas
        </p>
      </div>
    </div>
  );
}
