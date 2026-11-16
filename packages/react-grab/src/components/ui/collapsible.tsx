import type { ComponentProps, JSX, ValidComponent } from "solid-js";
import { Show, splitProps } from "solid-js";
import { Collapsible as CollapsiblePrimitive } from "@kobalte/core/collapsible";

import { cn } from "../../utils/cn.js";
import { ChevronIcon } from "./chevron-icon.jsx";

/* ─── Headless primitives (unchanged) ─── */

export type CollapsibleProps<T extends ValidComponent = "div"> = ComponentProps<
  typeof CollapsiblePrimitive<T>
>;

export const Collapsible = <T extends ValidComponent = "div">(
  props: CollapsibleProps<T>,
) => {
  return <CollapsiblePrimitive data-slot="collapsible" {...props} />;
};

export type CollapsibleTriggerProps<T extends ValidComponent = "button"> =
  ComponentProps<typeof CollapsiblePrimitive.Trigger<T>>;

export const CollapsibleTrigger = <T extends ValidComponent = "button">(
  props: CollapsibleTriggerProps<T>,
) => {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  );
};

export type CollapsibleContentProps<T extends ValidComponent = "div"> =
  ComponentProps<typeof CollapsiblePrimitive.Content<T>>;

export const CollapsibleContent = <T extends ValidComponent = "div">(
  props: CollapsibleContentProps<T>,
) => {
  const [local, rest] = splitProps(props as CollapsibleContentProps, ["class"]);

  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      class={cn("overflow-hidden", local.class)}
      {...rest}
    />
  );
};

/* ─── CollapsibleCard — styled composition ─── */

interface CollapsibleCardProps {
  /** Trigger row content (text, icon, badge — whatever goes in the header). */
  trigger: JSX.Element;
  /** Body content revealed on expand. */
  children: JSX.Element;
  /**
   * "card" = bordered card with shadow. "inline" = no chrome, flush with
   * parent. "panel" = a muted section inside a card. @default "card"
   */
  variant?: "card" | "inline" | "panel";
  /** Shown under the trigger whether the card is open or closed. */
  preview?: JSX.Element;
  /** Additional class on the outer card wrapper. */
  class?: string;
  /** Additional class on the trigger row. */
  triggerClass?: string;
  /** Additional class on the content wrapper. */
  contentClass?: string;
  /** Start expanded. @default true */
  defaultOpen?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /** Fires when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Disable toggle. */
  disabled?: boolean;
}

const rootStyles = {
  card: "rounded-lg border border-border bg-card shadow-sm",
  inline: "",
  panel: "rounded-lg border border-border bg-muted",
} as const;

const triggerStyles = {
  card: "gap-2 px-3 py-2 text-title leading-5 font-medium text-card-foreground hover:bg-accent/50 rounded-lg",
  inline:
    "gap-1.5 py-1 text-meta font-medium text-muted-foreground hover:opacity-100",
  panel:
    "gap-1.5 rounded-lg px-2.5 py-2 text-caption leading-4 font-medium text-foreground",
} as const;

const previewStyles = {
  card: "px-3 pb-2",
  inline: "pb-1",
  panel: "px-2.5 pb-2.5",
} as const;

const contentStyles = {
  card: "px-3 pb-3",
  inline: "pt-1",
  panel: "px-2.5 pb-2.5",
} as const;

export const CollapsibleCard = (props: CollapsibleCardProps) => {
  const variant = () => props.variant ?? "card";

  return (
    <CollapsiblePrimitive
      data-slot="collapsible-card"
      defaultOpen={props.defaultOpen ?? true}
      open={props.open}
      onOpenChange={props.onOpenChange}
      disabled={props.disabled}
      class={cn(rootStyles[variant()], props.class)}
    >
      <CollapsiblePrimitive.Trigger
        data-slot="collapsible-card-trigger"
        class={cn(
          "flex w-full items-center cursor-pointer select-none transition-colors data-[disabled]:cursor-default",
          "[&>svg.collapsible-chevron]:transition-transform [&>svg.collapsible-chevron]:duration-150",
          "[&[data-expanded]>svg.collapsible-chevron]:rotate-0",
          "[&[data-closed]>svg.collapsible-chevron]:-rotate-90",
          triggerStyles[variant()],
          props.triggerClass,
        )}
      >
        <Show when={!props.disabled}>
          <ChevronIcon class="collapsible-chevron text-muted-foreground" />
        </Show>
        {props.trigger}
      </CollapsiblePrimitive.Trigger>

      <Show when={props.preview}>
        <div
          data-slot="collapsible-card-preview"
          class={previewStyles[variant()]}
        >
          {props.preview}
        </div>
      </Show>

      <CollapsiblePrimitive.Content
        data-slot="collapsible-card-content"
        class="collapsible-card-body overflow-hidden"
      >
        <div class={cn(contentStyles[variant()], props.contentClass)}>
          {props.children}
        </div>
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive>
  );
};

export type { CollapsibleCardProps };
