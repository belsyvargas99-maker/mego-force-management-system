import React from 'react';

interface MegoLogoProps {
  logoUrl?: string;
  brandName?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

const DEFAULT_LOGO_ASSET = '/assets/aistudio/MEGO_FORCE_LOGO_b97e7c00.jpg';

export function MegoLogo({
  logoUrl,
  brandName = 'MEGO FORCE',
  size = 'md',
  showTagline = false,
}: MegoLogoProps) {
  const iconDims =
    size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  const textSize =
    size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-xl';

  const resolvedSrc = logoUrl?.trim() ? logoUrl.trim() : DEFAULT_LOGO_ASSET;

  return (
    <div className="flex items-center gap-3 shrink-0">
      <img
        src={resolvedSrc}
        alt={brandName}
        referrerPolicy="no-referrer"
        className={`${iconDims} object-cover rounded-full border border-[#ED1010]/70 bg-[#080808] shrink-0`}
      />
      <div className="leading-none">
        <span
          className={`font-display font-bold tracking-wider uppercase text-white whitespace-nowrap ${textSize}`}
        >
          {brandName}
        </span>
        {showTagline && (
          <p className="text-[11px] tracking-[0.18em] uppercase text-[#888888] mt-1 whitespace-nowrap">
            Performance Apparel Systems
          </p>
        )}
      </div>
    </div>
  );
}
