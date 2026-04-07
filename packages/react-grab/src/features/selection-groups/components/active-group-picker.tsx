import {
  createContext,
  createMemo,
  createSignal,
  Show,
  splitProps,
  useContext,
} from "solid-js";
import type {
  Accessor,
  Component,
  ComponentProps,
  ParentComponent,
  Setter,
} from "solid-js";
import type { SelectionGroup } from "../types.js";
import { Button } from "../../../components/ui/button.jsx";
import { cn } from "../../../utils/cn.js";
import { GroupPickerFlyout } from "./group-picker-flyout.jsx";

/**
 * Compound component for the active-group picker rendered inside the
 * selection-label. Composition pattern (shadcn / Kobalte style):
 *
 *   <ActiveGroupPicker {...stateProps}>
 *     <ActiveGroupPicker.Trigger />
 *     <ActiveGroupPicker.Content />
 *   </ActiveGroupPicker>
 *
 * The Root owns the open/close signal and exposes the data via context;
 * subcomponents are dumb consumers. This keeps the parent (selection-label)
 * free of state plumbing while preserving the ability to recompose the
 * trigger and content independently.
 */

interface ActiveGroupPickerContextValue {
  groups: Accessor<SelectionGroup[]>;
  activeGroupId: Accessor<string | null | undefined>;
  activeGroup: Accessor<SelectionGroup | undefined>;
  isOpen: Accessor<boolean>;
  setOpen: Setter<boolean>;
  toggle: () => void;
  selectGroup: (groupId: string | null) => void;
  onAddGroup?: (name: string) => void;
}

const ActiveGroupPickerContext =
  createContext<ActiveGroupPickerContextValue>();

const useActiveGroupPicker = (): ActiveGroupPickerContextValue => {
  const ctx = useContext(ActiveGroupPickerContext);
  if (!ctx) {
    throw new Error(
      "ActiveGroupPicker subcomponent must be used inside <ActiveGroupPicker>",
    );
  }
  return ctx;
};

interface ActiveGroupPickerRootProps {
  groups?: SelectionGroup[];
  activeGroupId?: string | null;
  onActiveGroupChange?: (groupId: string | null) => void;
  onAddGroup?: (name: string) => void;
  children: import("solid-js").JSX.Element;
}

const ActiveGroupPickerRoot: ParentComponent<ActiveGroupPickerRootProps> = (
  props,
) => {
  const [isOpen, setOpen] = createSignal(false);

  const groups = createMemo(() => props.groups ?? []);
  const activeGroupId = () => props.activeGroupId;
  const activeGroup = createMemo(() =>
    groups().find((g) => g.id === props.activeGroupId),
  );

  const toggle = () => setOpen((v) => !v);

  const selectGroup = (groupId: string | null) => {
    props.onActiveGroupChange?.(groupId);
    setOpen(false);
  };

  const value: ActiveGroupPickerContextValue = {
    groups,
    activeGroupId,
    activeGroup,
    isOpen,
    setOpen,
    toggle,
    selectGroup,
    get onAddGroup() {
      return props.onAddGroup;
    },
  };

  return (
    <ActiveGroupPickerContext.Provider value={value}>
      <div class="relative px-2 pb-1">{props.children}</div>
    </ActiveGroupPickerContext.Provider>
  );
};

const ChevronDownIcon: Component<{ rotated: boolean }> = (props) => (
  <svg
    width="8"
    height="8"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="text-muted-foreground transition-transform duration-100"
    style={{ transform: props.rotated ? "rotate(180deg)" : "" }}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const FolderIcon: Component = () => (
  <svg
    width="9"
    height="9"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="text-muted-foreground shrink-0"
  >
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const ActiveGroupPickerTrigger: Component<
  Omit<ComponentProps<typeof Button>, "onClick" | "type">
> = (props) => {
  const ctx = useActiveGroupPicker();
  const [local, rest] = splitProps(props, ["class"]);
  const label = () => ctx.activeGroup()?.name ?? "Ungrouped";

  return (
    <Button
      data-react-grab-ignore-events
      type="button"
      variant="ghost"
      class={cn(
        "h-auto gap-1 px-0.5 -mx-0.5 py-0 text-[11px] font-medium leading-none text-muted-foreground rounded-sm shadow-none",
        local.class,
      )}
      aria-haspopup="listbox"
      aria-expanded={ctx.isOpen()}
      onClick={(e) => {
        e.stopImmediatePropagation();
        ctx.toggle();
      }}
      {...rest}
    >
      <FolderIcon />
      <span>{label()}</span>
      <ChevronDownIcon rotated={ctx.isOpen()} />
    </Button>
  );
};

const ActiveGroupPickerContent: Component = () => {
  const ctx = useActiveGroupPicker();
  return (
    <Show when={ctx.isOpen()}>
      <GroupPickerFlyout
        groups={ctx.groups()}
        activeGroupId={ctx.activeGroupId() ?? null}
        onSelect={ctx.selectGroup}
        onClose={() => ctx.setOpen(false)}
        onAddGroup={ctx.onAddGroup}
      />
    </Show>
  );
};

export const ActiveGroupPicker = Object.assign(ActiveGroupPickerRoot, {
  Trigger: ActiveGroupPickerTrigger,
  Content: ActiveGroupPickerContent,
});
