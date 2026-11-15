import {
  type Component,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import { Dialog as DialogPrimitive } from "@kobalte/core/dialog";
import { useShadowMount } from "../../utils/shadow-context.js";
import { cn } from "../../utils/cn.js";
import { IconButton } from "./icon-button.js";

type ZoomMode = "fit" | "actual";

interface DragStart {
  x: number;
  y: number;
  scrollLeft: number;
  scrollTop: number;
}

interface ImageLightboxProps {
  open: boolean;
  src: string;
  caption: string;
  onClose: () => void;
}

export const ImageLightbox: Component<ImageLightboxProps> = (props) => {
  const [mode, setMode] = createSignal<ZoomMode>("fit");
  const [dragging, setDragging] = createSignal(false);
  let viewportRef: HTMLDivElement | undefined;
  let imageRef: HTMLImageElement | undefined;
  let dragStart: DragStart | null = null;

  // Reset mode to fit whenever src changes (so swapping images starts fresh)
  createEffect(
    on(
      () => props.src,
      () => {
        setMode("fit");
      },
    ),
  );

  // Esc-to-close. Kobalte's own Esc handler runs after the overlay's
  // document handlers; the capture phase + stopImmediatePropagation here keeps
  // the sidebar underneath from also reacting to the same keystroke.
  createEffect(() => {
    if (!props.open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        props.onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    onCleanup(() =>
      document.removeEventListener("keydown", handleKeyDown, true),
    );
  });

  // Any click bubbling up to the root closes — children that should NOT
  // close (topbar, image, close button) call stopPropagation in their own handlers.
  const handleBackdropClick = () => {
    props.onClose();
  };

  const handleImageClick = (event: MouseEvent) => {
    event.stopPropagation();
    setMode((prev) => (prev === "fit" ? "actual" : "fit"));
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (mode() !== "actual" || !viewportRef || !imageRef) return;
    setDragging(true);
    dragStart = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewportRef.scrollLeft,
      scrollTop: viewportRef.scrollTop,
    };
    imageRef.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!dragging() || !dragStart || !viewportRef) return;
    viewportRef.scrollLeft =
      dragStart.scrollLeft - (event.clientX - dragStart.x);
    viewportRef.scrollTop = dragStart.scrollTop - (event.clientY - dragStart.y);
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (!dragging()) return;
    setDragging(false);
    dragStart = null;
    imageRef?.releasePointerCapture(event.pointerId);
  };

  return (
    <DialogPrimitive
      open={props.open}
      onOpenChange={(isOpen) => {
        if (!isOpen) props.onClose();
      }}
    >
      <DialogPrimitive.Portal mount={useShadowMount()}>
        <DialogPrimitive.Overlay class="pointer-events-auto fixed inset-0 z-(--z-dialog) bg-black/80 backdrop-blur-sm" />
        <DialogPrimitive.Content
          data-react-grab-image-lightbox
          class="pointer-events-auto fixed inset-0 z-(--z-dialog) flex flex-col outline-none"
          aria-label={props.caption}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onClick={handleBackdropClick}
        >
          {/* Topbar */}
          <div
            class="relative flex items-center justify-between px-5 py-4 z-10"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-black/35 border border-white/10 backdrop-blur-sm">
              <span class="text-caption text-white/90">{props.caption}</span>
              <span class="text-meta text-white/55 font-mono uppercase">
                {mode() === "fit" ? "FIT" : "1:1"}
              </span>
            </div>
            <IconButton
              data-react-grab-lightbox-close
              data-react-grab-ignore-events
              label="Close"
              variant="ghost"
              size="icon"
              class="rounded-full border border-white/10 bg-black/40 text-title leading-none text-white hover:scale-105 hover:bg-white/15 hover:text-white"
              onClick={(event) => {
                event.stopPropagation();
                props.onClose();
              }}
            >
              ×
            </IconButton>
          </div>

          {/* Viewport — clicks on whitespace bubble to root and close */}
          <div
            ref={viewportRef}
            data-react-grab-lightbox-viewport
            data-mode={mode()}
            class={cn(
              "relative flex-1 flex p-12 z-10",
              mode() === "fit"
                ? "overflow-hidden items-center justify-center"
                : "overflow-auto items-start justify-start",
            )}
          >
            <img
              ref={imageRef}
              src={props.src}
              alt={props.caption}
              draggable={false}
              class={cn(
                "block select-none transition-[max-width,max-height] duration-200",
                mode() === "fit"
                  ? "max-w-[calc(100vw-96px)] max-h-[calc(100vh-96px)] object-contain cursor-zoom-in"
                  : dragging()
                    ? "cursor-grabbing"
                    : "cursor-zoom-out",
              )}
              onClick={handleImageClick}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </div>

          {/* Bottom hint */}
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/35 border border-white/10 text-meta text-white/55 backdrop-blur-sm pointer-events-none z-10">
            Click to toggle zoom · Esc to close
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive>
  );
};

export type { ImageLightboxProps };
