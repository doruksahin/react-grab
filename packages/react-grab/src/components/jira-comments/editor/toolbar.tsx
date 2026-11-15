import { type Component, type JSX, createSignal, Show } from "solid-js";
import { Button } from "../../ui/button.js";

export const ToolbarButton: Component<{
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: JSX.Element;
  dataAction?: string;
}> = (props) => (
  <Button
    type="button"
    variant="subtle"
    size="xs"
    title={props.title}
    aria-pressed={Boolean(props.active)}
    disabled={props.disabled}
    data-react-grab-ignore-events
    {...(props.dataAction
      ? { "data-react-grab-editor-action": props.dataAction }
      : {})}
    onMouseDown={(e) => {
      e.preventDefault();
      if (!props.disabled) props.onClick();
    }}
    style={{ "pointer-events": "auto" }}
  >
    {props.children}
  </Button>
);

export const ToolbarSeparator: Component = () => (
  <span class="w-px bg-border mx-1 self-stretch" />
);

export const ToolbarDropdown: Component<{
  title: string;
  label: JSX.Element;
  children: JSX.Element;
  dataDropdown?: string;
}> = (props) => {
  const [open, setOpen] = createSignal(false);

  return (
    <div class="relative" data-react-grab-ignore-events>
      <Button
        type="button"
        variant="subtle"
        size="xs"
        title={props.title}
        {...(props.dataDropdown
          ? { "data-react-grab-editor-dropdown": props.dataDropdown }
          : {})}
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        style={{ "pointer-events": "auto" }}
      >
        {props.label}
        <span class="text-muted-foreground">▾</span>
      </Button>
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
