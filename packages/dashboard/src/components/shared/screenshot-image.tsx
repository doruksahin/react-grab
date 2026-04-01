import { WORKSPACE_ID } from "@/lib/config";

interface ScreenshotImageProps {
  screenshotKey: string;
  alt: string;
  className?: string;
}

export function ScreenshotImage({ screenshotKey, alt, className }: ScreenshotImageProps) {
  // The key is like "my-workspace/screenshots/comment-123/element.png"
  // Extract selectionId and type from the key
  const parts = screenshotKey.split("/");
  const type = parts[parts.length - 1]?.replace(/\.\w+$/, ""); // "element" or "full"
  const selectionId = parts[parts.length - 2];

  if (!selectionId || !type) return null;

  const src = `/workspaces/${WORKSPACE_ID}/screenshots/${selectionId}/${type}`;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
    />
  );
}
