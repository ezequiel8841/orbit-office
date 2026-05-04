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

export const IconLink = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </>,
    p,
  );

export const IconImage = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </>,
    p,
  );

export const IconSearch = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>,
    p,
  );

export const IconPrinter = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </>,
    p,
  );

export const IconStrikethrough = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M16 4H9a3 3 0 00-2.83 4" />
      <path d="M14 12a4 4 0 010 8H6" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </>,
    p,
  );

export const IconCode = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </>,
    p,
  );

export const IconSubscript = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M4 5l8 8M12 5L4 13" />
      <path d="M20 19h-4c0-1.5.44-2 1.5-2.5S20 15.33 20 14c0-.47-.17-.93-.48-1.29a2.11 2.11 0 00-2.62-.44c-.42.24-.74.62-.9 1.07" />
    </>,
    p,
  );

export const IconSuperscript = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M4 19l8-8M12 19L4 11" />
      <path d="M20 12h-4c0-1.5.44-2 1.5-2.5S20 9.33 20 8c0-.47-.17-.93-.48-1.29a2.11 2.11 0 00-2.62-.44c-.42.24-.74.62-.9 1.07" />
    </>,
    p,
  );

export const IconClearFormatting = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M4 7V4h16v3" />
      <path d="M5 20h6" />
      <path d="M13 4l-6 16" />
      <line x1="17" y1="14" x2="22" y2="19" />
      <line x1="22" y1="14" x2="17" y2="19" />
    </>,
    p,
  );

export const IconAlignJustify = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </>,
    p,
  );

export const IconList = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </>,
    p,
  );

export const IconListOrdered = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </>,
    p,
  );

export const IconCheckSquare = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </>,
    p,
  );

export const IconMinus = (p: SVGProps<SVGSVGElement>) =>
  base(<line x1="5" y1="12" x2="19" y2="12" />, p);

export const IconSigma = (p: SVGProps<SVGSVGElement>) =>
  base(<path d="M18 4H6l6 8-6 8h12" />, p);

export const IconToc = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="5" x2="20" y2="5" />
      <line x1="7" y1="9" x2="20" y2="9" />
      <line x1="7" y1="13" x2="20" y2="13" />
      <line x1="7" y1="17" x2="20" y2="17" />
      <line x1="4" y1="21" x2="20" y2="21" />
    </>,
    p,
  );

export const IconPageBreak = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v5" />
      <path d="M3 19a2 2 0 002 2h14a2 2 0 002-2v-5" />
      <line x1="3" y1="12" x2="6" y2="12" strokeDasharray="2 2" />
      <line x1="10" y1="12" x2="14" y2="12" strokeDasharray="2 2" />
      <line x1="18" y1="12" x2="21" y2="12" strokeDasharray="2 2" />
    </>,
    p,
  );

export const IconFileWord = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13l2 6 2-4 2 4 2-6" />
    </>,
    p,
  );

export const IconPlay = (p: SVGProps<SVGSVGElement>) =>
  base(<polygon points="5 3 19 12 5 21 5 3" />, p);

export const IconLayoutGrid = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>,
    p,
  );

export const IconNotes = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </>,
    p,
  );

export const IconLock = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </>,
    p,
  );

export const IconUnlock = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 019.9-1" />
    </>,
    p,
  );

export const IconCopy = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </>,
    p,
  );

export const IconTrash = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </>,
    p,
  );

export const IconBringToFront = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <polyline points="8 7 12 3 16 7" />
      <polyline points="8 13 12 9 16 13" />
      <line x1="12" y1="3" x2="12" y2="13" />
      <line x1="4" y1="20" x2="20" y2="20" strokeDasharray="3 2" />
    </>,
    p,
  );

export const IconBringForward = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <polyline points="8 10 12 6 16 10" />
      <line x1="12" y1="6" x2="12" y2="19" />
      <line x1="4" y1="20" x2="20" y2="20" strokeDasharray="3 2" />
    </>,
    p,
  );

export const IconSendBackward = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="4" x2="20" y2="4" strokeDasharray="3 2" />
      <line x1="12" y1="5" x2="12" y2="18" />
      <polyline points="8 14 12 18 16 14" />
    </>,
    p,
  );

export const IconSendToBack = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="4" x2="20" y2="4" strokeDasharray="3 2" />
      <line x1="12" y1="5" x2="12" y2="15" />
      <polyline points="8 11 12 15 16 11" />
      <polyline points="8 17 12 21 16 17" />
    </>,
    p,
  );

export const IconAlignStartH = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="3" y1="4" x2="3" y2="20" strokeWidth="2.5" />
      <rect x="5" y="6" width="9" height="5" rx="1" />
      <rect x="5" y="13" width="14" height="5" rx="1" />
    </>,
    p,
  );

export const IconAlignCenterH = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="12" y1="4" x2="12" y2="20" strokeWidth="2.5" />
      <rect x="6.5" y="6" width="11" height="5" rx="1" />
      <rect x="4.5" y="13" width="15" height="5" rx="1" />
    </>,
    p,
  );

export const IconAlignEndH = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="21" y1="4" x2="21" y2="20" strokeWidth="2.5" />
      <rect x="10" y="6" width="9" height="5" rx="1" />
      <rect x="5" y="13" width="14" height="5" rx="1" />
    </>,
    p,
  );

export const IconAlignStartV = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="3" x2="20" y2="3" strokeWidth="2.5" />
      <rect x="6" y="5" width="5" height="9" rx="1" />
      <rect x="13" y="5" width="5" height="14" rx="1" />
    </>,
    p,
  );

export const IconAlignCenterV = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="12" x2="20" y2="12" strokeWidth="2.5" />
      <rect x="6" y="7" width="5" height="10" rx="1" />
      <rect x="13" y="4" width="5" height="16" rx="1" />
    </>,
    p,
  );

export const IconAlignEndV = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="21" x2="20" y2="21" strokeWidth="2.5" />
      <rect x="6" y="10" width="5" height="9" rx="1" />
      <rect x="13" y="5" width="5" height="14" rx="1" />
    </>,
    p,
  );

export const IconSpaceX = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="3" y1="4" x2="3" y2="20" />
      <line x1="21" y1="4" x2="21" y2="20" />
      <rect x="7" y="8" width="10" height="8" rx="1" />
    </>,
    p,
  );

export const IconSpaceY = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="3" x2="20" y2="3" />
      <line x1="4" y1="21" x2="20" y2="21" />
      <rect x="8" y="7" width="8" height="10" rx="1" />
    </>,
    p,
  );

export const IconShapeRect = (p: SVGProps<SVGSVGElement>) =>
  base(<rect x="3" y="6" width="18" height="12" rx="2" />, p);

export const IconShapeCircle = (p: SVGProps<SVGSVGElement>) =>
  base(<circle cx="12" cy="12" r="9" />, p);

export const IconShapeTriangle = (p: SVGProps<SVGSVGElement>) =>
  base(<path d="M12 3L22 20H2L12 3Z" />, p);

export const IconShapeDiamond = (p: SVGProps<SVGSVGElement>) =>
  base(<path d="M12 2L22 12L12 22L2 12Z" />, p);

export const IconShapeStar = (p: SVGProps<SVGSVGElement>) =>
  base(
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
    p,
  );

export const IconShapeLine = (p: SVGProps<SVGSVGElement>) =>
  base(<line x1="3" y1="12" x2="21" y2="12" />, p);

export const IconShapeArrow = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="12" x2="20" y2="12" />
      <polyline points="14 6 20 12 14 18" />
    </>,
    p,
  );

export const IconShapePentagon = (p: SVGProps<SVGSVGElement>) =>
  base(<polygon points="12 2 22 9.5 18 21 6 21 2 9.5" />, p);

export const IconShapeHexagon = (p: SVGProps<SVGSVGElement>) =>
  base(<polygon points="21 16 21 8 12 3 3 8 3 16 12 21" />, p);

export const IconLineHeight = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="4" y1="7" x2="14" y2="7" />
      <line x1="4" y1="12" x2="14" y2="12" />
      <line x1="4" y1="17" x2="14" y2="17" />
      <path d="M19 4v16M16 7l3-3 3 3M16 17l3 3 3-3" />
    </>,
    p,
  );

export const IconZoomIn = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </>,
    p,
  );

export const IconZoomOut = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </>,
    p,
  );

export const IconInsertRowBelow = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="3" width="18" height="9" rx="1" />
      <line x1="12" y1="15" x2="12" y2="21" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </>,
    p,
  );

export const IconInsertColLeft = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="12" y="3" width="9" height="18" rx="1" />
      <line x1="6" y1="12" x2="0" y2="12" />
      <line x1="3" y1="9" x2="3" y2="15" />
    </>,
    p,
  );

export const IconInsertColRight = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="3" width="9" height="18" rx="1" />
      <line x1="18" y1="12" x2="24" y2="12" />
      <line x1="21" y1="9" x2="21" y2="15" />
    </>,
    p,
  );

export const IconDeleteCol = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="12" y1="9" x2="12" y2="15" />
    </>,
    p,
  );

export const IconMessageSquare = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </>,
    p,
  );

export const IconSettings = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </>,
    p,
  );

export const IconColumns = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="18" rx="1" />
    </>,
    p,
  );

export const IconPanelLeft = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="13" y1="8" x2="19" y2="8" />
      <line x1="13" y1="12" x2="19" y2="12" />
      <line x1="13" y1="16" x2="19" y2="16" />
    </>,
    p,
  );

export const IconFileText = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="8" y1="9" x2="10" y2="9" />
    </>,
    p,
  );

export const IconBarChart = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </>,
    p,
  );

export const IconType = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </>,
    p,
  );

export const IconBookmark = (p: SVGProps<SVGSVGElement>) =>
  base(
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />,
    p,
  );

export const IconRefreshCw = (p: SVGProps<SVGSVGElement>) =>
  base(
    <>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </>,
    p,
  );
