// @orbitoffice/slides — Slide rendered at fixed 1920x1080 scaled to container.
import { useEffect, useRef, useState } from "react";
import { ElementView } from "./ElementView";
import { SLIDE_H, SLIDE_W, getTheme, type Slide, type Theme } from "./model";

interface ScaledSlideProps {
  slide: Slide;
  theme: Theme;
  autoFit?: boolean;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onContainerChange?: (rect: DOMRect, scale: number) => void;
}

function getSlideBgStyle(slide: Slide, theme: Theme): React.CSSProperties {
  if (slide.bgGradient) {
    const { c1, c2, angle } = slide.bgGradient;
    return { background: `linear-gradient(${angle}deg, ${c1}, ${c2})` };
  }
  if (slide.bgImage) {
    return {
      backgroundImage: `url(${slide.bgImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundColor: slide.background ?? theme.bg,
    };
  }
  return { background: slide.background ?? theme.bg };
}

export function ScaledSlide({
  slide,
  theme,
  autoFit = true,
  scale: scaleProp,
  className,
  style,
  children,
  onContainerChange,
}: ScaledSlideProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(scaleProp ?? 0.5);

  useEffect(() => {
    if (!autoFit) {
      if (scaleProp != null) setScale(scaleProp);
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const s = Math.min(r.width / SLIDE_W, r.height / SLIDE_H);
      setScale(s);
      onContainerChange?.(r, s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoFit, scaleProp, onContainerChange]);

  const bgStyle = getSlideBgStyle(slide, theme);

  return (
    <div
      ref={wrapRef}
      className={`oo-slide-stage ${className ?? ""}`}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        color: theme.fg,
        fontFamily: theme.font,
        ...bgStyle,
        ...style,
      }}
    >
      <div
        className="oo-slide-canvas"
        style={{
          position: "absolute",
          width: SLIDE_W,
          height: SLIDE_H,
          left: "50%",
          top: "50%",
          marginLeft: -SLIDE_W / 2,
          marginTop: -SLIDE_H / 2,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          ...bgStyle,
        }}
      >
        {slide.elements.map((el) => (
          <ElementView key={el.id} el={el} />
        ))}
        {children}
      </div>
    </div>
  );
}

export { SLIDE_H, SLIDE_W, getTheme };
