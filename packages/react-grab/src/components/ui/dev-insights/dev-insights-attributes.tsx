import type { Component } from "solid-js";
import { For, Show, createMemo } from "solid-js";
import { DevInsightsSection } from "./dev-insights-section.jsx";

interface ParsedAttribute {
  name: string;
  value: string;
}

const MAX_ATTR_VALUE_LENGTH = 20;

const IGNORED_ATTRS = new Set(["class", "style"]);

function parseAttributes(html: string): ParsedAttribute[] {
  const attrs: ParsedAttribute[] = [];
  const regex = /\s([\w-]+)(?:="([^"]*)")?/g;
  let match: RegExpExecArray | null;

  const tagEnd = html.indexOf(">");
  const tagPart = tagEnd !== -1 ? html.slice(0, tagEnd) : html;

  while ((match = regex.exec(tagPart)) !== null) {
    const name = match[1];
    if (IGNORED_ATTRS.has(name)) continue;
    const raw = match[2] ?? "";
    const value =
      raw.length > MAX_ATTR_VALUE_LENGTH
        ? `${raw.slice(0, MAX_ATTR_VALUE_LENGTH)}…`
        : raw;
    attrs.push({ name, value });
  }
  return attrs;
}

export interface DevInsightsAttributesProps {
  /** Raw HTML content from which attributes are parsed. */
  content: string | undefined;
}

export const DevInsightsAttributes: Component<DevInsightsAttributesProps> = (
  props,
) => {
  const attrs = createMemo(() =>
    props.content ? parseAttributes(props.content) : [],
  );

  return (
    <Show when={attrs().length > 0}>
      <DevInsightsSection label="attributes" count={attrs().length}>
        <For each={attrs()}>
          {(attr) => (
            <div class="text-[9px] leading-relaxed font-mono py-px">
              <span class="text-[#93a3b8]">{attr.name}</span>{" "}
              <span class="text-amber-400">"{attr.value}"</span>
            </div>
          )}
        </For>
      </DevInsightsSection>
    </Show>
  );
};
