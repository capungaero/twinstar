export const BRANCH_COLORS = [
  "#16a085",
  "#f97316",
  "#ef4444",
  "#7c3aed",
  "#0ea5e9",
  "#22c55e",
  "#eab308",
  "#db2777",
  "#6366f1",
  "#14b8a6"
];

export function getBranchColor(index: number) {
  return BRANCH_COLORS[index % BRANCH_COLORS.length];
}
