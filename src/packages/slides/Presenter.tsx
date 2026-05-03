// @orbitoffice/slides — fullscreen Presenter view.
import { useEffect, useRef, useState } from "react";
import { ScaledSlide } from "./ScaledSlide";
import { getTheme, type Deck } from "./model";

interface PresenterProps {
  deck: Deck;
  startIndex: number;
  onExit: () => void;
}

const CHANNEL = "orbitoffice:slides:presenter";

export function Presenter({ deck, startIndex, onExit }: PresenterProps) {
  const [idx, setIdx] = useState(startIndex);
  const [showNotes, setShowNotes] = useState(false);
  const [black, setBlack] = useState<"none" | "black" | "white">("none");
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      channelRef.current = new BroadcastChannel(CHANNEL);
      channelRef.current.postMessage({ type: "slide", idx });
    } catch { /* ignore */ }
    return () => channelRef.current?.close();
  }, [idx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      else if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown" || e.key === "ArrowDown") {
        e.preventDefault(); setIdx((i) => Math.min(deck.slides.length - 1, i + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "ArrowUp") {
        e.preventDefault(); setIdx((i) => Math.max(0, i - 1));
      } else if (e.key.toLowerCase() === "n") setShowNotes((v) => !v);
      else if (e.key.toLowerCase() === "b") setBlack((v) => (v === "black" ? "none" : "black"));
      else if (e.key.toLowerCase() === "w") setBlack((v) => (v === "white" ? "none" : "white"));
      else if (e.key.toLowerCase() === "p") {
        // open second window with audience view
        try { window.open(window.location.href + "#orbit-audience", "audience", "width=1280,height=720"); } catch { /* ignore */ }
      } else if (/^[0-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10) - 1;
        if (n >= 0 && n < deck.slides.length) setIdx(n);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck.slides.length, onExit]);

  const theme = getTheme(deck.themeId);
  const slide = deck.slides[idx];
  const next = deck.slides[idx + 1];
  const elapsedMs = now - startedAt;
  const mm = Math.floor(elapsedMs / 60000).toString().padStart(2, "0");
  const ss = Math.floor((elapsedMs % 60000) / 1000).toString().padStart(2, "0");

  if (black !== "none") {
    return (
      <div
        onClick={() => setBlack("none")}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: black === "black" ? "#000" : "#fff",
          cursor: "pointer",
        }}
      />
    );
  }

  if (showNotes) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "#0b0b0b", color: "#fff",
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gridTemplateRows: "1fr auto",
          gap: 12, padding: 12,
        }}
      >
        <div style={{ background: "#000", borderRadius: 8, overflow: "hidden", position: "relative" }}>
          <ScaledSlide slide={slide} theme={theme} autoFit />
          <Pill text={`${idx + 1} / ${deck.slides.length}`} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ background: "#000", borderRadius: 8, overflow: "hidden", aspectRatio: "16/9", position: "relative" }}>
            {next ? <ScaledSlide slide={next} theme={theme} autoFit /> : <Empty label="End of deck" />}
            <Pill text="Next" small />
          </div>
          <div style={{
            background: "#1a1a1a", borderRadius: 8, padding: 12, flex: 1, overflow: "auto",
            fontSize: 16, lineHeight: 1.4, whiteSpace: "pre-wrap",
          }}>
            <div style={{ opacity: 0.6, marginBottom: 8, fontSize: 12 }}>NOTES</div>
            {slide.notes || <span style={{ opacity: 0.5 }}>No notes</span>}
          </div>
          <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 12, fontVariantNumeric: "tabular-nums", fontSize: 28, textAlign: "center" }}>
            ⏱ {mm}:{ss}
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#888", fontSize: 12 }}>
          ← → space · N notes · B black · W white · 0-9 jump · Esc exit
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000", cursor: "none" }}
      onClick={() => setIdx((i) => Math.min(deck.slides.length - 1, i + 1))}
      onContextMenu={(e) => { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }}
    >
      <ScaledSlide slide={slide} theme={theme} autoFit />
      <Pill text={`${idx + 1} / ${deck.slides.length}`} />
    </div>
  );
}

function Pill({ text, small = false }: { text: string; small?: boolean }) {
  return (
    <div style={{
      position: "absolute",
      bottom: small ? 6 : 12,
      right: small ? 6 : 12,
      padding: small ? "2px 6px" : "4px 10px",
      background: "rgba(0,0,0,0.5)", color: "white",
      borderRadius: 4, fontSize: small ? 10 : 12, pointerEvents: "none",
    }}>{text}</div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: 14 }}>
      {label}
    </div>
  );
}
