// packages/react-grab/src/core/plugins/recorder/clipboard.ts

/**
 * Mirror of the execCommand-based clipboard write at copy-content.ts:72-107,
 * but with a plain-text payload (no application/x-react-grab MIME blob).
 * Reuses the mechanism per PRD-007's clipboard requirement and ADR-0009's
 * invariants. Does NOT introduce a navigator.clipboard.writeText path.
 */
export const writeRecordingToClipboard = (content: string): boolean => {
  const onCopy = (event: ClipboardEvent) => {
    event.preventDefault();
    event.clipboardData?.setData("text/plain", content);
  };

  document.addEventListener("copy", onCopy);

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.ariaHidden = "true";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (typeof document.execCommand !== "function") return false;
    return document.execCommand("copy");
  } finally {
    document.removeEventListener("copy", onCopy);
    textarea.remove();
  }
};
