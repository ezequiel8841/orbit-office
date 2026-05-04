import { useState } from "react";
import { OrbitOffice, type OrbitMode } from "@/packages/hub";
import { IconSheet, IconDoc, IconSlides } from "@/packages/icons";

const MODES: { id: OrbitMode; label: string; Icon: typeof IconSheet }[] = [
  { id: "sheet", label: "Sheet", Icon: IconSheet },
  { id: "doc", label: "Document", Icon: IconDoc },
  { id: "slides", label: "Slides", Icon: IconSlides },
];

const Index = () => {
  const [mode, setMode] = useState<OrbitMode>("sheet");
  return (
    <div className="oo-root" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "10px 16px",
          borderBottom: "1px solid var(--oo-color-border)",
          background: "var(--oo-color-bg-alt)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: -0.2 }}>
          OrbitOffice
        </h1>
        <span style={{ color: "var(--oo-color-fg-muted)", fontSize: 12 }}>
          Lightweight office suite — playground
        </span>
        <nav style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              className="oo-btn"
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
              style={{ padding: "0 10px" }}
            >
              <Icon />
              <span style={{ marginLeft: 6 }}>{label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main style={{ flex: 1, minHeight: 0 }}>
        <OrbitOffice mode={mode} persistKey="orbitoffice:demo" licenseKey={import.meta.env.VITE_LICENSE_KEY ?? ""} style={{ height: "100%" }} />
      </main>
    </div>
  );
};

export default Index;
