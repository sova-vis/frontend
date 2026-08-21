"use client";

import { useId } from "react";

/* ==========================================================================
   Propel — decorative study objects
   Hand-built, colour-filled SVG illustrations with gradient shading + soft
   drop-shadows so they read as real 3D objects (books, pens, leaves, a grad
   cap, a marked script…). Shared by the dashboard StudyScene and the landing
   hero. Every instance gets its own gradient/filter ids (useId) so multiple
   copies never clash. Purely decorative → callers wrap them aria-hidden.
   ========================================================================== */

type Obj = { size?: number; className?: string; style?: React.CSSProperties };

/* ---- Realistic leaf: filled body, midrib + veins, two-tone gradient ---- */
export function Leaf({ size = 22, c1 = "#F5C542", c2 = "#C77E00", className, style }: Obj & { c1?: string; c2?: string }) {
  const u = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} style={style}>
      <defs>
        <linearGradient id={`l${u}`} x1="7" y1="4" x2="25" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
        <filter id={`ls${u}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1" floodColor="#1C1714" floodOpacity="0.28" />
        </filter>
      </defs>
      <path d="M16 2C24 8 27.5 18 16.5 30 5.5 18 8 8 16 2Z" fill={`url(#l${u})`} stroke={c2} strokeOpacity="0.5" strokeWidth="0.6" filter={`url(#ls${u})`} />
      <path d="M16.2 5.4 16.5 28.4" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M16.3 11 11 9M16.3 15 10.6 14M16.4 19 11.6 20.2M16.3 11 21.4 9.5M16.3 15 22 14.6M16.4 19 20.9 20.4" stroke="#fff" strokeOpacity="0.34" strokeWidth="0.7" strokeLinecap="round" />
    </svg>
  );
}

/* ---- Stack of 3 closed hardcover books, shaded for depth ---- */
export function BookStack({ size = 64, className, style }: Obj) {
  const u = useId().replace(/:/g, "");
  const Book = ({ x, y, w, h, top, a, b, page }: { x: number; y: number; w: number; h: number; top: string; a: string; b: string; page: string }) => (
    <g>
      <rect x={x + 2.5} y={y - 2.5} width={w} height={h} rx="2.5" fill={top} />
      <rect x={x} y={y} width={w} height={h} rx="2.5" fill={`url(#${a})`} />
      <rect x={x + 3} y={y + 2.4} width="2.4" height={h - 4.8} rx="1.2" fill="#000" opacity="0.18" />
      <rect x={x + 3.5} y={y + h - 3.4} width={w - 7} height="2.3" rx="1" fill={page} />
      <rect x={x + 3.5} y={y + h - 3.1} width={w - 7} height="0.7" fill="#000" opacity="0.08" />
      <rect x={x + w * 0.28} y={y + 2.2} width={w * 0.4} height="1.3" rx="0.6" fill="#fff" opacity="0.5" />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 64 60" fill="none" className={className} style={style}>
      <defs>
        <linearGradient id={`b1${u}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#C41E4A" /><stop offset="1" stopColor="#8E0F30" /></linearGradient>
        <linearGradient id={`b2${u}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#1F9E7B" /><stop offset="1" stopColor="#0E6E52" /></linearGradient>
        <linearGradient id={`b3${u}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#F5C542" /><stop offset="1" stopColor="#D08E10" /></linearGradient>
        <filter id={`bs${u}`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#1C1714" floodOpacity="0.3" /></filter>
      </defs>
      <ellipse cx="32" cy="55" rx="24" ry="3.4" fill="#1C1714" opacity="0.16" />
      <g filter={`url(#bs${u})`}>
        <Book x={9} y={40} w={46} h={12} top="#7A0D2C" a={`b1${u}`} b="#8E0F30" page="#F7ECEC" />
        <Book x={13} y={29} w={39} h={11} top="#0C5E45" a={`b2${u}`} b="#0E6E52" page="#EAF6F1" />
        <Book x={11} y={19} w={35} h={10} top="#B67A08" a={`b3${u}`} b="#D08E10" page="#FBF3DC" />
      </g>
      {/* bookmark ribbon from the top book */}
      <path d="M40 19 H45 V31 L42.5 28 40 31 Z" fill="#E0563B" />
    </svg>
  );
}

/* ---- Open book with curved pages + ruled lines ---- */
export function OpenBook({ size = 64, className, style }: Obj) {
  const u = useId().replace(/:/g, "");
  return (
    <svg width={size} height={(size * 44) / 60} viewBox="0 0 60 44" fill="none" className={className} style={style}>
      <defs>
        <linearGradient id={`oc${u}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#C41E4A" /><stop offset="1" stopColor="#8E0F30" /></linearGradient>
        <linearGradient id={`op${u}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#FFFFFF" /><stop offset="1" stopColor="#EDE6DC" /></linearGradient>
        <filter id={`of${u}`} x="-15%" y="-15%" width="130%" height="130%"><feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#1C1714" floodOpacity="0.28" /></filter>
      </defs>
      <path d="M4 11 Q30 5 30 9 Q30 5 56 11 L56 40 Q30 34 30 38 Q30 34 4 40 Z" fill={`url(#oc${u})`} filter={`url(#of${u})`} />
      <path d="M7 12.5 Q30 7.5 29 10.5 L29 36.5 Q30 33 7 37.5 Z" fill={`url(#op${u})`} />
      <path d="M53 12.5 Q30 7.5 31 10.5 L31 36.5 Q30 33 53 37.5 Z" fill={`url(#op${u})`} />
      <path d="M30 10.5 L30 37" stroke="#1C1714" strokeOpacity="0.14" strokeWidth="1" />
      <path d="M11 16 24 14M11 20 24 18.5M11 24 24 22.5M36 14 49 16M35.5 18.5 49 20M35.5 22.5 49 24" stroke="#9C8F7E" strokeOpacity="0.55" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

/* ---- Yellow hex pencil: eraser, ferrule, faceted body, wood tip, graphite ---- */
export function Pencil({ size = 60, className, style }: Obj) {
  const u = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 24 64" fill="none" className={className} style={style}>
      <defs>
        <linearGradient id={`pw${u}`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#EBB86B" /><stop offset="0.5" stopColor="#D08E4A" /><stop offset="1" stopColor="#B06E30" /></linearGradient>
        <filter id={`pf${u}`} x="-40%" y="-10%" width="180%" height="120%"><feDropShadow dx="1.4" dy="1.4" stdDeviation="1.2" floodColor="#1C1714" floodOpacity="0.28" /></filter>
      </defs>
      <g filter={`url(#pf${u})`}>
        <rect x="7" y="2" width="10" height="7" rx="3" fill="#EF9BB6" />
        <rect x="7" y="2" width="4" height="7" rx="2" fill="#F6BCD0" />
        <rect x="6.5" y="8.5" width="11" height="5" rx="1.2" fill="#C6CBD3" />
        <rect x="6.5" y="9.6" width="11" height="1" fill="#9AA1AC" /><rect x="6.5" y="11.6" width="11" height="1" fill="#9AA1AC" />
        {/* faceted yellow body */}
        <rect x="6.5" y="13" width="11" height="37" fill="#F5C542" />
        <rect x="6.5" y="13" width="4" height="37" fill="#F8D976" />
        <rect x="14" y="13" width="3.5" height="37" fill="#DDA916" />
        {/* wood cone */}
        <path d="M6.5 50 H17.5 L12 60 Z" fill={`url(#pw${u})`} />
        <path d="M12 50 L12 60" stroke="#8A5A22" strokeOpacity="0.35" strokeWidth="0.8" />
        {/* graphite tip */}
        <path d="M9.6 56 H14.4 L12 62 Z" fill="#33333B" />
      </g>
    </svg>
  );
}

/* ---- Sleek pen: capped barrel, chrome nib, clip, gold band ---- */
export function Pen({ size = 60, className, style }: Obj) {
  const u = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 20 64" fill="none" className={className} style={style}>
      <defs>
        <linearGradient id={`pb${u}`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#2B6C8F" /><stop offset="0.5" stopColor="#17506E" /><stop offset="1" stopColor="#0E3A50" /></linearGradient>
        <linearGradient id={`pn${u}`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#EDF1F4" /><stop offset="0.5" stopColor="#B9C1CB" /><stop offset="1" stopColor="#8A94A1" /></linearGradient>
        <filter id={`pf${u}`} x="-40%" y="-8%" width="180%" height="116%"><feDropShadow dx="1.4" dy="1.4" stdDeviation="1.2" floodColor="#1C1714" floodOpacity="0.28" /></filter>
      </defs>
      <g filter={`url(#pf${u})`}>
        <rect x="4.5" y="3" width="11" height="24" rx="5" fill="#0E3A50" />
        <rect x="6" y="4.5" width="2.4" height="20" rx="1.2" fill="#fff" opacity="0.28" />
        <rect x="13.5" y="5" width="2.2" height="13" rx="1.1" fill="#C6CBD3" />
        <rect x="4.5" y="27" width="11" height="3" fill="#E8B84B" />
        <rect x="5" y="30" width="10" height="15" rx="2" fill={`url(#pb${u})`} />
        <path d="M5 45 H15 L10 60 Z" fill={`url(#pn${u})`} />
        <path d="M10 47 L10 58" stroke="#5A6472" strokeWidth="0.8" />
        <circle cx="10" cy="49" r="1.1" fill="#5A6472" />
      </g>
    </svg>
  );
}

/* ---- Graduation cap: mortarboard, band, button, gold tassel ---- */
export function GradCap({ size = 64, className, style }: Obj) {
  const u = useId().replace(/:/g, "");
  return (
    <svg width={size} height={(size * 48) / 64} viewBox="0 0 64 48" fill="none" className={className} style={style}>
      <defs>
        <linearGradient id={`gt${u}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#2A211C" /><stop offset="1" stopColor="#151009" /></linearGradient>
        <filter id={`gf${u}`} x="-15%" y="-15%" width="130%" height="140%"><feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#1C1714" floodOpacity="0.3" /></filter>
      </defs>
      <g filter={`url(#gf${u})`}>
        <path d="M22 22 H42 L40 35 Q32 39 24 35 Z" fill="#1A130D" />
        <path d="M32 6 58 18 32 30 6 18 Z" fill={`url(#gt${u})`} />
        <path d="M32 6 58 18 32 30 Z" fill="#000" opacity="0.14" />
      </g>
      <circle cx="32" cy="18" r="2.4" fill="#F5C542" />
      <path d="M32 18 51 18 51 33" stroke="#E8B84B" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <rect x="48.5" y="32" width="5" height="8" rx="2.5" fill="#F5C542" />
      <path d="M49.5 40 V44 M51 40 V44.5 M52.5 40 V44" stroke="#D8A21F" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

/* ---- Marked exam script: paper, ruled lines, red tick + A* grade ---- */
export function MarkedScript({ size = 56, className, style }: Obj) {
  const u = useId().replace(/:/g, "");
  const h = (size * 66) / 52;
  return (
    <svg width={size} height={h} viewBox="0 0 52 66" fill="none" className={className} style={style}>
      <defs>
        <linearGradient id={`ms${u}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#FFFFFF" /><stop offset="1" stopColor="#F2EBE0" /></linearGradient>
        <filter id={`mf${u}`} x="-20%" y="-12%" width="140%" height="128%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.2" floodColor="#1C1714" floodOpacity="0.26" /></filter>
      </defs>
      <g filter={`url(#mf${u})`}>
        <path d="M5 5 H37 L47 15 V61 H5 Z" fill={`url(#ms${u})`} />
        <path d="M37 5 47 15 H37 Z" fill="#DCD3C4" />
      </g>
      <path d="M10 26 34 26M10 32 38 32M10 38 30 38M10 44 37 44M10 50 26 50" stroke="#B9AE9C" strokeOpacity="0.7" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M9 20 12.5 24 20 15" stroke="#C41E4A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <text x="31" y="60" fontFamily="Georgia, 'Times New Roman', serif" fontSize="15" fontWeight="700" fill="#C41E4A">A*</text>
    </svg>
  );
}

/* ---- Sticky note with a mark-scheme code (colour always paired w/ symbol) ---- */
export function StickyMark({ sym, code, size = 46, base = "#DBF1E9", ink = "#0E6E52", className, style }: Obj & { sym: string; code: string; base?: string; ink?: string }) {
  const u = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" fill="none" className={className} style={style}>
      <defs>
        <filter id={`sf${u}`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="#1C1714" floodOpacity="0.26" /></filter>
      </defs>
      <g filter={`url(#sf${u})`}>
        <path d="M6 6 H40 V34 L34 40 H6 Z" fill={base} />
        <path d="M40 34 L34 40 V34 Z" fill="#000" opacity="0.12" />
        <rect x="6" y="6" width="34" height="5" fill="#000" opacity="0.05" />
      </g>
      <text x="23" y="27" textAnchor="middle" fontFamily="ui-monospace, 'SF Mono', Menlo, monospace" fontSize="13" fontWeight="700" fill={ink}>
        {sym} {code}
      </text>
    </svg>
  );
}

/* ---- Score dial on a dark card ---- */
export function ScoreDial({ value = 4, total = 6, size = 58, className, style }: Obj & { value?: number; total?: number }) {
  const u = useId().replace(/:/g, "");
  const r = 19, C = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 58 58" fill="none" className={className} style={style}>
      <defs>
        <linearGradient id={`sc${u}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#2A211C" /><stop offset="1" stopColor="#120D08" /></linearGradient>
        <filter id={`sd${u}`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#1C1714" floodOpacity="0.32" /></filter>
      </defs>
      <rect x="3" y="3" width="52" height="52" rx="15" fill={`url(#sc${u})`} filter={`url(#sd${u})`} />
      <g transform="rotate(-90 29 29)">
        <circle cx="29" cy="29" r={r} fill="none" stroke="rgba(250,246,240,0.18)" strokeWidth="5" />
        <circle cx="29" cy="29" r={r} fill="none" stroke="#5FD3B3" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - value / total)} />
      </g>
      <text x="29" y="33" textAnchor="middle" fontFamily="Georgia, serif" fontSize="12.5" fontWeight="700" fill="#FAF6F0">{value}/{total}</text>
    </svg>
  );
}
