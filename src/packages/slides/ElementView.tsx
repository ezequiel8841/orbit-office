// @orbitoffice/slides — render a single element (presentation-only).
import type { SlideElement } from "./model";

export function ElementView({ el }: { el: SlideElement }) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    opacity: el.opacity ?? 1,
  };

  if (el.type === "text") {
    return (
      <div
        style={{
          ...baseStyle,
          color: el.color,
          fontFamily: el.fontFamily,
          fontSize: el.fontSize,
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? "italic" : undefined,
          textDecoration: el.underline ? "underline" : undefined,
          textAlign: el.align ?? "left",
          lineHeight: 1.25,
          overflow: "hidden",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
        dangerouslySetInnerHTML={{ __html: el.html }}
      />
    );
  }

  if (el.type === "image") {
    return (
      <img
        src={el.src}
        alt={el.alt ?? ""}
        style={{ ...baseStyle, objectFit: "contain" } as React.CSSProperties}
        draggable={false}
      />
    );
  }

  // shape
  const stroke = el.stroke ?? "transparent";
  const sw = el.strokeWidth ?? 0;
  const fill = el.fill ?? "#2563eb";
  const w = el.w, h = el.h;
  let shapeNode: React.ReactNode = null;
  switch (el.shape) {
    case "rect":
      shapeNode = <rect x={sw / 2} y={sw / 2} width={w - sw} height={h - sw} fill={fill} stroke={stroke} strokeWidth={sw} rx={6} />;
      break;
    case "ellipse":
      shapeNode = <ellipse cx={w / 2} cy={h / 2} rx={(w - sw) / 2} ry={(h - sw) / 2} fill={fill} stroke={stroke} strokeWidth={sw} />;
      break;
    case "triangle":
      shapeNode = <polygon points={`${w / 2},${sw} ${w - sw},${h - sw} ${sw},${h - sw}`} fill={fill} stroke={stroke} strokeWidth={sw} />;
      break;
    case "line":
      shapeNode = <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke={fill} strokeWidth={Math.max(sw, 4)} />;
      break;
    case "arrow": {
      const head = Math.min(40, h / 2);
      shapeNode = (
        <g>
          <line x1={0} y1={h / 2} x2={w - head} y2={h / 2} stroke={fill} strokeWidth={Math.max(sw, 6)} />
          <polygon points={`${w},${h / 2} ${w - head},${h / 2 - head / 2} ${w - head},${h / 2 + head / 2}`} fill={fill} />
        </g>
      );
      break;
    }
    case "star": {
      const cx = w / 2, cy = h / 2;
      const ro = Math.min(w, h) / 2 - sw;
      const ri = ro / 2.5;
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const ang = (Math.PI / 5) * i - Math.PI / 2;
        const r = i % 2 === 0 ? ro : ri;
        pts.push(`${cx + Math.cos(ang) * r},${cy + Math.sin(ang) * r}`);
      }
      shapeNode = <polygon points={pts.join(" ")} fill={fill} stroke={stroke} strokeWidth={sw} />;
      break;
    }
  }
  return (
    <svg style={baseStyle} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {shapeNode}
    </svg>
  );
}
