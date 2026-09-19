/** Mirrors the web app's palette in app/globals.css. */
export const theme = {
  background: "#000000",
  foreground: "#ffffff",
  accent: "#1db954",
  muted: "#8b8b8b",
  border: "#1f1f1f",
  surface: "#0d0d0d",
  /** Raised surfaces — sheets and modals, so they read apart from the black app. */
  elevated: "#1c1c1e",
} as const;
