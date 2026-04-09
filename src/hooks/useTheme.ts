import { useContext } from "react";
import { ThemeProviderContext, type ThemeContextValue } from "@/hooks/theme-context";

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeProviderContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
