import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type FontSize = "pequena" | "padrao" | "grande" | "extra";

export type AppearanceSettings = {
  fontSize: FontSize;
  /** Zoom global da interface (1 = 100%). */
  zoom?: number;
  colors: {
    background: string;
    foreground: string;
    accent: string;
    muted: string;
    card: string;
    border: string;
  };
  logoUrl: string | null;
};

export const FONT_SIZES: { key: FontSize; label: string; px: string }[] = [
  { key: "pequena", label: "Pequena", px: "15px" },
  { key: "padrao", label: "Padrão", px: "16px" },
  { key: "grande", label: "Grande", px: "17.5px" },
  { key: "extra", label: "Extra grande", px: "19px" },
];

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  fontSize: "padrao",
  zoom: 1,
  colors: {
    background: "#F7F5F2",
    foreground: "#202020",
    accent: "#8B5E34",
    muted: "#707070",
    card: "#F2F0ED",
    border: "#E8E6E3",
  },
  logoUrl: null,
};



const STORAGE_KEY = "porcelane_appearance_v1";

const AppearanceCtx = createContext<{
  settings: AppearanceSettings;
  setSettings: (s: AppearanceSettings) => void;
  preview: (s: AppearanceSettings | null) => void;
}>({ settings: DEFAULT_APPEARANCE, setSettings: () => {}, preview: () => {} });

export function applyAppearance(s: AppearanceSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--background", s.colors.background);
  root.style.setProperty("--canvas", s.colors.background);
  root.style.setProperty("--foreground", s.colors.foreground);
  root.style.setProperty("--primary", s.colors.foreground);
  root.style.setProperty("--accent", s.colors.accent);
  root.style.setProperty("--muted-foreground", s.colors.muted);
  root.style.setProperty("--secondary", s.colors.card);
  root.style.setProperty("--muted", s.colors.card);
  root.style.setProperty("--border", s.colors.border);
  root.style.setProperty("--input", s.colors.border);
  const scale = FONT_SIZES.find((f) => f.key === s.fontSize)?.px ?? "16px";
  root.style.fontSize = scale;
  const zoom = s.zoom ?? 1;
  root.style.setProperty("--ui-zoom", String(zoom));

}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) } as AppearanceSettings;
        setSettingsState(parsed);
        applyAppearance(parsed);
      } else {
        applyAppearance(DEFAULT_APPEARANCE);
      }
    } catch {
      applyAppearance(DEFAULT_APPEARANCE);
    }
  }, []);

  const setSettings = (s: AppearanceSettings) => {
    setSettingsState(s);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    applyAppearance(s);
  };

  const preview = (s: AppearanceSettings | null) => {
    applyAppearance(s ?? settings);
  };

  return (
    <AppearanceCtx.Provider value={{ settings, setSettings, preview }}>
      {children}
    </AppearanceCtx.Provider>
  );
}

export const useAppearance = () => useContext(AppearanceCtx);
