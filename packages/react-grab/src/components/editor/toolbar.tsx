import { type Component, type JSX, createSignal, Show } from "solid-js";

export const ToolbarButton: Component<{
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: JSX.Element;
}> = (props) => (
  <button
    type="button"
    title={props.title}
    disabled={props.disabled}
    data-react-grab-ignore-events
    onMouseDown={(e) => {
      e.preventDefault();
      if (!props.disabled) props.onClick();
    }}
    class={[
      "px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors",
      props.active
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-accent",
      props.disabled ? "opacity-30 cursor-not-allowed" : "",
    ].join(" ")}
    style={{ "pointer-events": "auto" }}
  >
    {props.children}
  </button>
);

export const ToolbarSeparator: Component = () => (
  <span class="w-px bg-border mx-1 self-stretch" />
);

export const ToolbarDropdown: Component<{
  title: string;
  label: JSX.Element;
  children: JSX.Element;
}> = (props) => {
  const [open, setOpen] = createSignal(false);

  return (
    <div class="relative" data-react-grab-ignore-events>
      <button
        type="button"
        title={props.title}
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        class="px-1.5 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-0.5"
        style={{ "pointer-events": "auto" }}
      >
        {props.label}
        <span class="text-[8px] text-muted-foreground">▾</span>
      </button>
      <Show when={open()}>
        <div
          class="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 min-w-[120px] p-1"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen(false)}
        >
          {props.children}
        </div>
      </Show>
    </div>
  );
};
