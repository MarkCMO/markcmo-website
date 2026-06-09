import { Mood } from "./types";

export const Colors = {
  navy: "#0A1628",
  blue: "#2563EB",
  orange: "#F97316",
  green: "#16A34A",
  bg: "#FFFAF7",
  card: "#FFFFFF",
  text: "#1E293B",
  muted: "#64748B",
};

export function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function timeStr(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

export function moodEmoji(m: Mood): string {
  switch (m) {
    case "happy": return "\u{1F60A}";
    case "content": return "\u{1F642}";
    case "needsAttention": return "\u{1F610}";
    case "sad": return "\u{1F622}";
    case "pleaseHelp": return "\u{1F97A}";
  }
}

export function moodTint(m: Mood): string {
  switch (m) {
    case "happy": return "#22C55E";
    case "content": return "#34D399";
    case "needsAttention": return "#EAB308";
    case "sad": return "#F97316";
    case "pleaseHelp": return "#EF4444";
  }
}
