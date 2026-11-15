import { type Component, type JSX, createSignal } from "solid-js";
import { Button } from "../../ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.js";
import { FLOATING_GAP_PX } from "../../../constants.js";

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
    <Popover
      open={open()}
      onOpenChange={setOpen}
      placement="bottom-start"
      gutter={FLOATING_GAP_PX}
    >
      <PopoverTrigger
        as={Button}
        type="button"
        variant="subtle"
        size="xs"
        title={props.title}
        data-react-grab-ignore-events
        {...(props.dataDropdown
          ? { "data-react-grab-editor-dropdown": props.dataDropdown }
          : {})}
        // Keep the editor's focus and selection while the dropdown opens.
        onMouseDown={(event: MouseEvent) => event.preventDefault()}
        style={{ "pointer-events": "auto" }}
      >
        {props.label}
        <span class="text-muted-foreground">▾</span>
      </PopoverTrigger>
      <PopoverContent
        data-react-grab-ignore-events
        class="min-w-[120px]"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onMouseDown={(event: MouseEvent) => event.preventDefault()}
        onClick={() => setOpen(false)}
      >
        {props.children}
      </PopoverContent>
    </Popover>
  );
};
