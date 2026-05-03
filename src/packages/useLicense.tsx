import { useEffect, useState } from "react";
import { validateLicenseKey } from "./license";

type LicenseState = "pending" | "valid" | "invalid";

export function useLicense(key: string | undefined): LicenseState {
  const [state, setState] = useState<LicenseState>("pending");

  useEffect(() => {
    if (!key) { setState("invalid"); return; }
    let cancelled = false;
    validateLicenseKey(key).then((ok) => {
      if (!cancelled) setState(ok ? "valid" : "invalid");
    });
    return () => { cancelled = true; };
  }, [key]);

  return state;
}

export function LicenseGate({
  licenseKey,
  children,
}: {
  licenseKey: string | undefined;
  children: React.ReactNode;
}) {
  const state = useLicense(licenseKey);

  if (state === "pending") {
    return <div style={OVERLAY_STYLE}><span style={TEXT_STYLE}>OrbitOffice</span></div>;
  }

  if (state === "invalid") {
    return (
      <div style={OVERLAY_STYLE}>
        <span style={TEXT_STYLE}>🔒 OrbitOffice</span>
        <span style={SUB_STYLE}>Licença inválida ou ausente.</span>
      </div>
    );
  }

  return <>{children}</>;
}

const OVERLAY_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  minHeight: 120,
  background: "#f8f8f8",
  border: "1px solid #e0e0e0",
  borderRadius: 8,
  gap: 8,
  userSelect: "none",
};

const TEXT_STYLE: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  fontWeight: 600,
  fontSize: 18,
  color: "#333",
};

const SUB_STYLE: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  fontSize: 13,
  color: "#888",
};
