import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Star, Trash2, Maximize2, X, Shirt } from 'lucide-react';
import type { MockupImage } from '../types/mego';

interface ImageGalleryProps {
  images: MockupImage[];
  editable?: boolean;
  onChange?: (next: MockupImage[]) => void;
}

export function ImageGallery({
  images,
  editable = false,
  onChange,
}: ImageGalleryProps) {
  const sorted = [...images].sort((a, b) => a.order - b.order);
  const primary = sorted.find((i) => i.isPrimary) || sorted[0] || null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const activeImage = sorted.find((i) => i.id === selectedId) || primary;

  const setPrimary = (id: string) => {
    if (!onChange) return;
    onChange(sorted.map((img) => ({ ...img, isPrimary: img.id === id })));
  };

  const updateCaption = (id: string, caption: string) => {
    if (!onChange) return;
    onChange(sorted.map((img) => (img.id === id ? { ...img, caption } : img)));
  };

  const removeImage = (id: string) => {
    if (!onChange) return;
    const remaining = sorted.filter((img) => img.id !== id).map((img, i) => ({ ...img, order: i }));
    if (remaining.length > 0 && !remaining.some((r) => r.isPrimary)) {
      remaining[0].isPrimary = true;
    }
    onChange(remaining);
  };

  const moveImage = (index: number, delta: -1 | 1) => {
    if (!onChange) return;
    const target = index + delta;
    if (target < 0 || target >= sorted.length) return;
    const copy = [...sorted];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    onChange(copy.map((img, i) => ({ ...img, order: i })));
  };

  if (sorted.length === 0) {
    return (
      <div className="aspect-[4/3] w-full bg-[#0F0F0F] border border-[#292929] rounded-lg flex flex-col items-center justify-center gap-2 text-[#888888] p-6">
        <Shirt className="w-10 h-10 opacity-50" />
        <p className="text-sm">Sin imágenes de mockup cargadas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeImage && (
        <div className="relative aspect-[4/3] w-full bg-[#0B0B0B] border border-[#292929] rounded-lg overflow-hidden group">
          <img
            src={activeImage.url}
            alt={activeImage.caption || 'Mockup oficial MEGO FORCE'}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain"
          />
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label="Ampliar mockup"
            className="absolute top-3 right-3 w-9 h-9 rounded-md bg-black/75 border border-[#292929] text-white flex items-center justify-center hover:border-[#ED1010] transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          {activeImage.caption && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 py-3">
              <p className="text-xs sm:text-sm text-white font-medium">
                {activeImage.caption}
              </p>
            </div>
          )}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {sorted.map((img, idx) => {
            const isSelected = activeImage?.id === img.id;
            return (
              <div
                key={img.id}
                className={`bg-[#141414] border rounded-md overflow-hidden transition-colors ${
                  isSelected ? 'border-[#ED1010]' : 'border-[#292929]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(img.id)}
                  className="w-full aspect-[4/3] bg-[#0B0B0B] block overflow-hidden"
                >
                  <img
                    src={img.url}
                    alt={img.caption || `Vista ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </button>

                {editable && (
                  <div className="p-2 space-y-2 border-t border-[#292929]">
                    <input
                      type="text"
                      value={img.caption}
                      onChange={(e) => updateCaption(img.id, e.target.value)}
                      placeholder="Descripción..."
                      aria-label={`Descripción de imagen ${idx + 1}`}
                      className="w-full px-2 py-1 text-xs bg-[#080808] border border-[#292929] rounded text-white outline-none focus:border-[#ED1010]"
                    />
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => setPrimary(img.id)}
                        title="Marcar como portada principal"
                        aria-label="Marcar como portada principal"
                        className={`p-1.5 rounded text-xs flex items-center gap-1 ${
                          img.isPrimary
                            ? 'bg-[#ED1010] text-white'
                            : 'bg-[#1C1C1C] text-[#888888] hover:text-white'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveImage(idx, -1)}
                          disabled={idx === 0}
                          aria-label="Mover a la izquierda"
                          className="p-1.5 rounded bg-[#1C1C1C] text-white disabled:opacity-30"
                        >
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(idx, 1)}
                          disabled={idx === sorted.length - 1}
                          aria-label="Mover a la derecha"
                          className="p-1.5 rounded bg-[#1C1C1C] text-white disabled:opacity-30"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          aria-label={`Eliminar mockup ${img.caption || idx + 1}`}
                          className="p-1.5 rounded bg-[#1C1C1C] text-[#F87171] hover:bg-[#ED1010]/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {zoomed && activeImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label="Cerrar vista ampliada"
            className="absolute top-4 right-4 w-11 h-11 rounded-md bg-[#141414] border border-[#292929] text-white flex items-center justify-center hover:border-[#ED1010]"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={activeImage.url}
            alt={activeImage.caption || 'Mockup ampliado'}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[88vh] object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
