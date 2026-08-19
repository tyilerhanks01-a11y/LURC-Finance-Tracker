// Shared design tokens — navy/gold theme matching the LURC crest branding.
// Kept as a single source of truth so the app, privacy page, confirmation
// page, and email template (which can't import JS, so copies these values
// literally) all stay in sync.
export const T = {
  bg: "#0f1c33", // page background — deep navy
  panel: "#16264a", // card/panel background
  track: "#24365c", // recessed elements sitting on a panel (progress-bar track, grid gaps)
  ink: "#f2ede1", // primary text (parchment/white) on navy
  muted: "#9aa8c7", // secondary text — labels, hints
  faint: "#6f7c9c", // most muted — footer text
  border: "#f2ede1", // crisp card/input border
  hairline: "#33456b", // subtle 1px row dividers, chart gridlines
  accent: "#c99a3e", // gold — brand accent, used sparingly (kickers, primary actions)
  accentInk: "#12203f", // text/icon color placed on top of the gold accent
  danger: "#e2685c",
  success: "#8fb473",
  purple: "#b39ddb",
};

export const PALETTE = [
  "#c99a3e",
  "#d9836f",
  "#e0a95c",
  "#8fb473",
  "#b39ddb",
  "#6fa8c9",
  "#b7bccf",
  "#e2685c",
  "#6fc2a8",
  "#d4a06c",
];
