import { createContext } from "react";

export type ThemeMode = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  toggle: () => void;
}

export const ThemeProviderContext = createContext<ThemeContextValue | null>(null);
