import type { SelectionGroupWithJira } from "./jira-types.js";

export interface StatusColorConfig {
  hex: string; // border + badge border
  bg: string; // badge background (12% alpha)
  text: string; // badge text color
}

const ATT_STATUS_COLORS: Record<string, StatusColorConfig> = {
  "To Do": { hex: "#94a3b8", bg: "rgba(148,163,184,0.12)", text: "#94a3b8" },
  "In Progress": {
    hex: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    text: "#3b82f6",
  },
  "Code Review": {
    hex: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    text: "#a78bfa",
  },
  Test: { hex: "#f59e0b", bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
  "Test Passed": {
    hex: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    text: "#10b981",
  },
  UAT: { hex: "#06b6d4", bg: "rgba(6,182,212,0.12)", text: "#06b6d4" },
  "In Preprod": {
    hex: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    text: "#8b5cf6",
  },
  "In Production": {
    hex: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    text: "#22c55e",
  },
  "Won't Do": { hex: "#ef4444", bg: "rgba(239,68,68,0.12)", text: "#ef4444" },
  Done: { hex: "#22c55e", bg: "rgba(34,197,94,0.12)", text: "#22c55e" },
};

const NO_TASK_COLOR: StatusColorConfig = {
  hex: "#b21c8e",
  bg: "rgba(178,28,142,0.12)",
  text: "#b21c8e",
};

const UNKNOWN_COLOR: StatusColorConfig = {
  hex: "#6b7280",
  bg: "rgba(107,114,128,0.12)",
  text: "#6b7280",
};

export const ALL_ATT_STATUSES = Object.keys(ATT_STATUS_COLORS);

export function getStatusColor(
  jiraStatus: string | undefined,
): StatusColorConfig {
  if (!jiraStatus) return NO_TASK_COLOR;
  return ATT_STATUS_COLORS[jiraStatus] ?? UNKNOWN_COLOR;
}

export function getStatusLabel(group: SelectionGroupWithJira): string {
  return group.jiraTicketId ? (group.jiraStatus ?? "To Do") : "No Task";
}
