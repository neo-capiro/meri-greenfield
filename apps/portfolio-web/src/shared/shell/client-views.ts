/** Shared navigation metadata; routes and feature behavior remain feature-owned. */
export const clientViews = [
  { label: "Overview", suffix: "", icon: 3 },
  { label: "Objectives", suffix: "/objectives", icon: 4 },
  { label: "Calendar", suffix: "/calendar", icon: 5 },
  { label: "Relationships", suffix: "/relationships", icon: 1 },
  { label: "Work", suffix: "/work", icon: 6 },
  { label: "Capabilities", suffix: "/capabilities", icon: 7 },
  { label: "Bill Tracker", suffix: "/bills", icon: 8 },
  { label: "Opportunities", suffix: "/opportunities", icon: 9 },
  { label: "Files", suffix: "/files", icon: 8 },
] as const;
