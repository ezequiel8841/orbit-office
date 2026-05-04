// @orbitoffice/icons — minimal in-house SVG icons. Tree-shakable.
import type { SVGProps } from "react";

const base = (path: React.ReactNode, props: SVGProps<SVGSVGElement>) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {path}
  </svg>
);

export const IconBold = (p: SVGProps<SVGSVGElement>) =>
  base(<path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z" />, p);

export const IconItalic = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </>,
    p,
  );

export const IconUnderline = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M6 4v8a6 6 0 0012 0V4" />
      <line x1="4" y1="20" x2="20" y2="20" />
    </>,
    p,
  );

export const IconAlignLeft = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="14" y2="12" />
      <line x1="4" y1="18" x2="18" y2="18" />
    </>,
    p,
  );

export const IconAlignCenter = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="5" y1="18" x2="19" y2="18" />
    </>,
    p,
  );

export const IconAlignRight = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="6" y1="18" x2="20" y2="18" />
    </>,
    p,
  );

export const IconUndo = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 00-4-4H4" />
    </>,
    p,
  );

export const IconRedo = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <polyline points="15 14 20 9 15 4" />
      <path d="M4 20v-7a4 4 0 014-4h12" />
    </>,
    p,
  );

export const IconDownload = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>,
    p,
  );

export const IconUpload = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>,
    p,
  );

export const IconSheet = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </>,
    p,
  );

export const IconDoc = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </>,
    p,
  );

export const IconSlides = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <line x1="8" y1="22" x2="16" y2="22" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </>,
    p,
  );

export const IconSortAsc = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M3 6h13M3 12h9M3 18h5" />
      <path d="M17 16l4 4 4-4" transform="translate(-3,-3)" />
      <path d="M18 19V7" />
    </>,
    p,
  );

export const IconSortDesc = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M3 6h5M3 12h9M3 18h13" />
      <path d="M18 5v12" />
      <path d="M14 13l4 4 4-4" />
    </>,
    p,
  );

export const IconFilter = (p: SVGProps<SVGSVGElement>) =>
  base(
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
    p,
  );

export const IconMerge = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M8 4v16M16 4v16" />
      <path d="M11 10l-2 2 2 2M13 10l2 2-2 2" />
    </>,
    p,
  );

export const IconUnmerge = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M12 4v16" />
      <path d="M9 10l-2 2 2 2M15 10l2 2-2 2" />
    </>,
    p,
  );

export const IconBorderAll = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="3" width="18" height="18" />
      <path d="M3 12h18M12 3v18" />
    </>,
    p,
  );

export const IconBorderOutside = (p: SVGProps<SVGSVGElement>) =>
  base(<rect x="3" y="3" width="18" height="18" strokeWidth="2.5" />, p);

export const IconBorderClear = (p: SVGProps<SVGSVGElement>) =>
  base(<rect x="3" y="3" width="18" height="18" strokeDasharray="2 2" />, p);

export const IconFreeze = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="3" width="18" height="18" />
      <line x1="3" y1="9" x2="21" y2="9" strokeWidth="2.5" />
      <line x1="9" y1="3" x2="9" y2="21" strokeWidth="2.5" />
    </>,
    p,
  );

export const IconChart = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M3 3v18h18" />
      <path d="M7 14l3-4 4 3 5-7" />
    </>,
    p,
  );

export const IconCheck = (p: SVGProps<SVGSVGElement>) =>
  base(<polyline points="20 6 9 17 4 12" />, p);

export const IconWrapText = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <path d="M4 12h13a3 3 0 010 6H4" />
      <polyline points="8 15 4 18 8 21" />
    </>,
    p,
  );

export const IconInsertRowAbove = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="12" width="18" height="9" rx="1" />
      <line x1="12" y1="3" x2="12" y2="9" />
      <line x1="9" y1="6" x2="15" y2="6" />
    </>,
    p,
  );

export const IconDeleteRow = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="9" y1="17" x2="15" y2="17" />
      <line x1="12" y1="14" x2="12" y2="20" />
    </>,
    p,
  );
