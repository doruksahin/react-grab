// Text colours offered in the Jira comment editor. The hex value is written
// into the comment body sent to Jira, so these are data, not overlay theme
// colours (the avatar palette in styles.css starts with the same eight hues
// but is a CSS token set for the overlay's own use).
export interface EditorTextColor {
  value: string;
  name: string;
}

export const EDITOR_TEXT_COLORS: ReadonlyArray<EditorTextColor> = [
  { value: "#e74c3c", name: "Red" },
  { value: "#e67e22", name: "Orange" },
  { value: "#f1c40f", name: "Yellow" },
  { value: "#2ecc71", name: "Green" },
  { value: "#1abc9c", name: "Teal" },
  { value: "#3498db", name: "Blue" },
  { value: "#9b59b6", name: "Purple" },
  { value: "#e91e63", name: "Pink" },
  { value: "#95a5a6", name: "Gray" },
  { value: "#2c3e50", name: "Navy" },
];
