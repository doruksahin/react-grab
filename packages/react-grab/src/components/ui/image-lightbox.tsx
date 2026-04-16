import { type Component, Show, createEffect, createSignal, on, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import type { ImageLightboxProps } from "../../features/image-lightbox/types.js";
import { useShadowMount } from "../../utils/shadow-context.js";
import { cn } from "../../utils/cn.js";

type ZoomMode = "fit" | "actual";

interface DragStart {
  x: number;
  y: number;
  scrollLeft: number;
  scrollTop: number;
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

  // Esc-to-close — only when open
  createEffect(() => {
    if (!props.open) return;
    // Capture phase + stopImmediatePropagation prevents the sidebar's focus
    // trap (or any other Esc handler on the page) from also reacting to the
    // same keystroke and closing the parent surface underneath the lightbox.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        props.onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown, true));
  });

  // Body scroll lock — restore previous overflow on close
  createEffect(() => {
    if (!props.open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onCleanup(() => {
      document.body.style.overflow = previous;
    });
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
    viewportRef.scrollLeft = dragStart.scrollLeft - (event.clientX - dragStart.x);
    viewportRef.scrollTop = dragStart.scrollTop - (event.clientY - dragStart.y);
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (!dragging()) return;
    setDragging(false);
    dragStart = null;
    imageRef?.releasePointerCapture(event.pointerId);
  };

  return (
    <Show when={props.open}>
      <Portal mount={useShadowMount()}>
        <div
          data-react-grab-image-lightbox
          class="fixed inset-0 flex flex-col"
          style={{ "z-index": "var(--z-dialog)", "pointer-events": "auto" }}
          role="dialog"
          aria-modal="true"
          aria-label={props.caption}
          onClick={handleBackdropClick}
        >
          <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          {/* Topbar */}
          <div
            class="relative flex items-center justify-between px-5 py-4 z-10"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-black/35 border border-white/10 backdrop-blur-sm">
              <span class="text-xs text-white/90">{props.caption}</span>
              <span class="text-[10px] text-white/55 font-mono uppercase">
                {mode() === "fit" ? "FIT" : "1:1"}
              </span>
            </div>
            <button
              data-react-grab-lightbox-close
              data-react-grab-ignore-events
              aria-label="Close"
              title="Close (Esc)"
              class="size-9 rounded-full border border-white/10 bg-black/40 text-white text-lg leading-none hover:bg-white/15 hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
              onClick={(event) => {
                event.stopPropagation();
                props.onClose();
              }}
            >
              ×
            </button>
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
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/35 border border-white/10 text-[11px] text-white/55 backdrop-blur-sm pointer-events-none z-10">
            Click to toggle zoom · Esc to close
          </div>
        </div>
      </Portal>
    </Show>
  );
};
