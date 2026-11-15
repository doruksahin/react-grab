const AVATAR_COLOR_TOKENS = [
  "var(--color-avatar-1)",
  "var(--color-avatar-2)",
  "var(--color-avatar-3)",
  "var(--color-avatar-4)",
  "var(--color-avatar-5)",
  "var(--color-avatar-6)",
  "var(--color-avatar-7)",
  "var(--color-avatar-8)",
];

export const getAvatarColor = (name: string | null | undefined): string => {
  let hash = 0;
  for (const character of name ?? "")
    hash = character.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLOR_TOKENS[Math.abs(hash) % AVATAR_COLOR_TOKENS.length];
};
