// packages/react-grab/src/components/sidebar/label-select.tsx
import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import { createFilter } from "@kobalte/core";
import { Combobox, ComboboxInput } from "../ui/combobox.js";
import { useShadowMount } from "../../utils/shadow-context.js";

interface LabelSelectProps {
  allLabels: string[];
  value: string[];
  onChange: (values: string[]) => void;
}

const filter = createFilter({ sensitivity: "base" });

// Stable empty array — passed as controlled `value` so Kobalte never accumulates
// internally; we own all selection state via `selected` signal.
const EMPTY: string[] = [];

export const LabelSelect: Component<LabelSelectProps> = (props) => {
  const [selected, setSelected] = createSignal<string[]>(props.value ?? []);
  const [inputValue, setInputValue] = createSignal("");
  let inputRef: HTMLInputElement | undefined;

  const filteredOptions = createMemo(() => {
    const query = inputValue();
    if (!query) return props.allLabels;
    return props.allLabels.filter((opt) => filter.contains(opt, query));
  });

  function update(next: string[]) {
    setSelected(next);
    props.onChange(next);
  }

  function toggle(val: string) {
    update(
      selected().includes(val)
        ? selected().filter((x) => x !== val)
        : [...selected(), val],
    );
  }

  function addCustom() {
    const val = inputValue().trim();
    setInputValue("");
    if (inputRef) inputRef.value = "";
    if (!val || selected().includes(val)) return;
    update([...selected(), val]);
  }

  return (
    <Combobox<string>
      multiple
      value={EMPTY}
      inputValue={inputValue()}
      onInputChange={setInputValue}
      onChange={(values: string[]) => {
        // Kobalte always fires with [toggledItem] since it sees value=[] each time
        if (values[0]) toggle(values[0]);
      }}
      options={filteredOptions()}
      closeOnSelection={false}
      selectionBehavior="toggle"
      sameWidth
      itemComponent={(itemProps) => (
        <Combobox.Item
          item={itemProps.item}
          class="relative flex w-full cursor-default select-none items-center justify-between rounded-sm py-1.5 px-2 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50"
        >
          <Combobox.ItemLabel class="text-[12px]">{itemProps.item.rawValue}</Combobox.ItemLabel>
          <Show when={selected().includes(itemProps.item.rawValue)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m5 12l5 5L20 7" />
            </svg>
          </Show>
        </Combobox.Item>
      )}
    >
      <Combobox.Control<string> aria-label="Labels">
        {(_state) => (
          <div
            class="flex flex-wrap gap-1 min-h-[36px] w-full px-2 py-1 rounded-md border border-border bg-muted text-[12px] text-foreground items-center"
            style={{ "pointer-events": "auto" }}
          >
            <For each={selected()}>
              {(lbl) => (
                <span class="bg-accent text-accent-foreground text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  {lbl}
                  <button
                    type="button"
                    class="leading-none hover:opacity-70"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggle(lbl);
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
            </For>
            <ComboboxInput
              ref={inputRef}
              class="flex-1 min-w-[80px] text-[12px]"
              style={{ "pointer-events": "auto" }}
              placeholder={selected().length === 0 ? "Search or type a label…" : ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <Combobox.Trigger
              class="ml-1 opacity-50 hover:opacity-100 shrink-0"
              style={{ "pointer-events": "auto" }}
            >
              <Combobox.Icon class="flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </Combobox.Icon>
            </Combobox.Trigger>
          </div>
        )}
      </Combobox.Control>
      <Combobox.Portal mount={useShadowMount()}>
        <Combobox.Content class="relative z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 origin-[--kb-combobox-content-transform-origin]">
          <Show
            when={filteredOptions().length > 0}
            fallback={
              <div class="px-3 py-2 text-[11px] text-muted-foreground italic">
                No labels found — press Enter to add
              </div>
            }
          >
            <Combobox.Listbox class="p-1 max-h-48 overflow-y-auto" />
          </Show>
        </Combobox.Content>
      </Combobox.Portal>
    </Combobox>
  );
};
