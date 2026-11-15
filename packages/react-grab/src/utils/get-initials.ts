const MAX_INITIALS = 2;

export const getInitials = (name: string | null | undefined): string =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_INITIALS)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
