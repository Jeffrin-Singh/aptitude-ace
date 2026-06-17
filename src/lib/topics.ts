export const TOPICS = [
  { slug: "percentages", name: "Percentages", icon: "Percent" },
  { slug: "profit-loss", name: "Profit & Loss", icon: "TrendingUp" },
  { slug: "averages", name: "Averages", icon: "BarChart3" },
  { slug: "time-work", name: "Time & Work", icon: "Clock" },
  { slug: "speed-distance", name: "Speed & Distance", icon: "Gauge" },
  { slug: "number-system", name: "Number System", icon: "Hash" },
  { slug: "ratio-proportion", name: "Ratio & Proportion", icon: "Scale" },
] as const;

export const TOPIC_BY_SLUG: Record<string, string> = {
  percentages: "Percentages",
  "profit-loss": "Profit & Loss",
  averages: "Averages",
  "time-work": "Time & Work",
  "speed-distance": "Speed & Distance",
  "number-system": "Number System",
  "ratio-proportion": "Ratio & Proportion",
};

export const SLUG_BY_TOPIC: Record<string, string> = Object.fromEntries(
  Object.entries(TOPIC_BY_SLUG).map(([k, v]) => [v, k]),
);

export type Difficulty = "easy" | "medium" | "hard";

export const TIMER_MINUTES: Record<Difficulty, number> = {
  easy: 60,
  medium: 75,
  hard: 90,
};
