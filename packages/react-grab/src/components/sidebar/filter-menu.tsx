import { type Component, For, Show } from "solid-js";
import type { FilterState } from "../../features/sidebar/filter-state.js";
import {
  type DueDatePreset,
  DUE_DATE_PRESET_ORDER,
  DUE_DATE_PRESET_LABEL_ALL,
  dueDatePresetLabel,
} from "../../features/sidebar/due-date/index.js";
import { ALL_ATT_STATUSES } from "../../features/sidebar/status-colors.js";
import { Button } from "../ui/button.js";
import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/menu.js";

interface FilterMenuProps {
  filter: FilterState;
  assignees: string[];
  reporters: string[];
  labels: string[];
  onFilterChange: (filter: FilterState) => void;
}

const countActive = (filter: FilterState): number => {
  let n = 0;
  if (filter.statuses.size > 0) n += 1;
  if (filter.assignee !== null) n += 1;
  if (filter.reporter !== null) n += 1;
  if (filter.label !== null) n += 1;
  if (filter.dueDatePreset !== null) n += 1;
  return n;
};

const emptyFilter = (): FilterState => ({
  statuses: new Set(),
  assignee: null,
  reporter: null,
  label: null,
  dueDatePreset: null,
});

const ChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 16 16">
    <path
      fill="currentColor"
      d="m6.03 1.47 6 6a.75.75 0 0 1 .052 1.004l-.052.056-6 6-1.06-1.06L10.44 8 4.97 2.53z"
    />
  </svg>
);

export const FilterMenu: Component<FilterMenuProps> = (props) => {
  const activeCount = () => countActive(props.filter);
  const handleClear = () => props.onFilterChange(emptyFilter());

  // Status
  const STATUS_ALL = "";
  const handleStatusChange = (value: string) => {
    const statuses =
      value === STATUS_ALL ? new Set<string>() : new Set([value]);
    props.onFilterChange({ ...props.filter, statuses });
  };
  const currentStatus = () => [...props.filter.statuses][0] ?? STATUS_ALL;
  const currentStatusLabel = () =>
    currentStatus() === STATUS_ALL ? "All" : currentStatus();

  // Assignee
  const handleAssigneeChange = (value: string) => {
    props.onFilterChange({
      ...props.filter,
      assignee: value === "" ? null : value,
    });
  };
  const currentAssigneeValue = () => props.filter.assignee ?? "";
  const currentAssigneeLabel = () => props.filter.assignee ?? "All";

  // Reporter
  const handleReporterChange = (value: string) => {
    props.onFilterChange({
      ...props.filter,
      reporter: value === "" ? null : value,
    });
  };
  const currentReporterValue = () => props.filter.reporter ?? "";
  const currentReporterLabel = () => props.filter.reporter ?? "All";

  // Label
  const handleLabelChange = (value: string) => {
    props.onFilterChange({
      ...props.filter,
      label: value === "" ? null : value,
    });
  };
  const currentLabelValue = () => props.filter.label ?? "";
  const currentLabelLabel = () => props.filter.label ?? "All";

  // Due date
  const handleDueDateChange = (value: string) => {
    const preset = value === "" ? null : (value as DueDatePreset);
    props.onFilterChange({ ...props.filter, dueDatePreset: preset });
  };
  const currentDueValue = () => props.filter.dueDatePreset ?? "";
  const currentDueLabel = () =>
    props.filter.dueDatePreset === null
      ? "All"
      : dueDatePresetLabel(props.filter.dueDatePreset);

  const valueClass = (active: boolean) =>
    `text-[11px] max-w-[120px] truncate ${active ? "text-primary" : "text-muted-foreground"}`;

  return (
    <>
      <Menu modal={false}>
        <MenuTrigger
          aria-label="Filter"
          classList={{ "border-primary/50": activeCount() > 0 }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M7 12h10" />
            <path d="M11 18h2" />
          </svg>
          <span class="text-muted-foreground font-medium">Filter</span>
          <Show when={activeCount() > 0}>
            <span
              data-react-grab-filter-badge
              class="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold inline-flex items-center justify-center ring-2 ring-background"
            >
              {activeCount()}
            </span>
          </Show>
        </MenuTrigger>

        <MenuContent>
          {/* Status */}
          <MenuSub>
            <MenuSubTrigger data-react-grab-filter-row="status">
              <span class="flex items-center gap-2">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                </svg>
                <span class="font-medium">Status</span>
              </span>
              <span class="flex items-center gap-1">
                <span class={valueClass(props.filter.statuses.size > 0)}>
                  {currentStatusLabel()}
                </span>
                <ChevronRight />
              </span>
            </MenuSubTrigger>
            <MenuSubContent>
              <MenuRadioGroup
                value={currentStatus()}
                onChange={handleStatusChange}
              >
                <MenuRadioItem value="">All Statuses</MenuRadioItem>
                <MenuRadioItem value="No Task">No Task</MenuRadioItem>
                <For each={ALL_ATT_STATUSES}>
                  {(status) => (
                    <MenuRadioItem value={status}>{status}</MenuRadioItem>
                  )}
                </For>
              </MenuRadioGroup>
            </MenuSubContent>
          </MenuSub>

          {/* Assignee */}
          <MenuSub>
            <MenuSubTrigger data-react-grab-filter-row="assignee">
              <span class="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 16 16">
                  <path
                    fill="currentColor"
                    fill-rule="evenodd"
                    d="M8 1.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4 4a4 4 0 1 1 8 0 4 4 0 0 1-8 0m-2 9a3.75 3.75 0 0 1 3.75-3.75h4.5A3.75 3.75 0 0 1 14 13v2h-1.5v-2a2.25 2.25 0 0 0-2.25-2.25h-4.5A2.25 2.25 0 0 0 3.5 13v2H2z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span class="font-medium">Assignee</span>
              </span>
              <span class="flex items-center gap-1">
                <span class={valueClass(props.filter.assignee !== null)}>
                  {currentAssigneeLabel()}
                </span>
                <ChevronRight />
              </span>
            </MenuSubTrigger>
            <MenuSubContent>
              <MenuRadioGroup
                value={currentAssigneeValue()}
                onChange={handleAssigneeChange}
              >
                <MenuRadioItem value="">All Assignees</MenuRadioItem>
                <For each={props.assignees}>
                  {(name) => <MenuRadioItem value={name}>{name}</MenuRadioItem>}
                </For>
              </MenuRadioGroup>
            </MenuSubContent>
          </MenuSub>

          {/* Reporter */}
          <MenuSub>
            <MenuSubTrigger data-react-grab-filter-row="reporter">
              <span class="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 16 16">
                  <path
                    fill="currentColor"
                    fill-rule="evenodd"
                    d="M8 1.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4 4a4 4 0 1 1 8 0 4 4 0 0 1-8 0m-2 9a3.75 3.75 0 0 1 3.75-3.75h4.5A3.75 3.75 0 0 1 14 13v2h-1.5v-2a2.25 2.25 0 0 0-2.25-2.25h-4.5A2.25 2.25 0 0 0 3.5 13v2H2z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span class="font-medium">Reporter</span>
              </span>
              <span class="flex items-center gap-1">
                <span class={valueClass(props.filter.reporter !== null)}>
                  {currentReporterLabel()}
                </span>
                <ChevronRight />
              </span>
            </MenuSubTrigger>
            <MenuSubContent>
              <MenuRadioGroup
                value={currentReporterValue()}
                onChange={handleReporterChange}
              >
                <MenuRadioItem value="">All Reporters</MenuRadioItem>
                <For each={props.reporters}>
                  {(name) => <MenuRadioItem value={name}>{name}</MenuRadioItem>}
                </For>
              </MenuRadioGroup>
            </MenuSubContent>
          </MenuSub>

          {/* Label — conditional on data availability */}
          <Show when={props.labels.length > 0}>
            <MenuSub>
              <MenuSubTrigger data-react-grab-filter-row="label">
                <span class="flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 16 16">
                    <path
                      fill="currentColor"
                      d="M11 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
                    />
                    <path
                      fill="currentColor"
                      fill-rule="evenodd"
                      d="M9.286 1a3.25 3.25 0 0 0-2.299.952L1.604 7.336a2 2 0 0 0 0 2.828l4.232 4.232a2 2 0 0 0 2.828 0l5.384-5.383A3.25 3.25 0 0 0 15 6.714V3a2 2 0 0 0-2-2zM8.048 3.013A1.75 1.75 0 0 1 9.286 2.5H13a.5.5 0 0 1 .5.5v3.714c0 .465-.184.91-.513 1.238l-5.383 5.384a.5.5 0 0 1-.708 0L2.664 9.104a.5.5 0 0 1 0-.708z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <span class="font-medium">Label</span>
                </span>
                <span class="flex items-center gap-1">
                  <span class={valueClass(props.filter.label !== null)}>
                    {currentLabelLabel()}
                  </span>
                  <ChevronRight />
                </span>
              </MenuSubTrigger>
              <MenuSubContent>
                <MenuRadioGroup
                  value={currentLabelValue()}
                  onChange={handleLabelChange}
                >
                  <MenuRadioItem value="">All Labels</MenuRadioItem>
                  <For each={props.labels}>
                    {(name) => (
                      <MenuRadioItem value={name}>{name}</MenuRadioItem>
                    )}
                  </For>
                </MenuRadioGroup>
              </MenuSubContent>
            </MenuSub>
          </Show>

          {/* Due date */}
          <MenuSub>
            <MenuSubTrigger
              data-react-grab-filter-row="due-date"
              data-react-grab-due-date-filter
            >
              <span class="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 16 16">
                  <path
                    fill="currentColor"
                    fill-rule="evenodd"
                    d="M4.5 2.5v2H6v-2h4v2h1.5v-2H13a.5.5 0 0 1 .5.5v3h-11V3a.5.5 0 0 1 .5-.5zm-2 5V13a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V7.5zm9-6.5H13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1.5V0H6v1h4V0h1.5z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span class="font-medium">Due date</span>
              </span>
              <span class="flex items-center gap-1">
                <span class={valueClass(props.filter.dueDatePreset !== null)}>
                  {currentDueLabel()}
                </span>
                <ChevronRight />
              </span>
            </MenuSubTrigger>
            <MenuSubContent>
              <MenuRadioGroup
                value={currentDueValue()}
                onChange={handleDueDateChange}
              >
                <MenuRadioItem value="">
                  {DUE_DATE_PRESET_LABEL_ALL}
                </MenuRadioItem>
                <For each={DUE_DATE_PRESET_ORDER}>
                  {(preset) => (
                    <MenuRadioItem value={preset}>
                      {dueDatePresetLabel(preset)}
                    </MenuRadioItem>
                  )}
                </For>
              </MenuRadioGroup>
            </MenuSubContent>
          </MenuSub>
        </MenuContent>
      </Menu>

      <Show when={activeCount() > 0}>
        <Button
          variant="ghost"
          size="sm"
          class="text-[10px] text-muted-foreground hover:text-foreground h-auto py-0.5 px-1.5 whitespace-nowrap"
          onClick={handleClear}
          data-react-grab-filter-clear
        >
          ✕ Clear
        </Button>
      </Show>
    </>
  );
};
