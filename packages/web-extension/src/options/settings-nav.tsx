import { For } from "solid-js";
import {
  SECTION_ORDER,
  SECTION_TITLES,
  type SectionId,
} from "./settings-sections.js";

interface SettingsNavProps {
  active: SectionId;
  /** A short state or count shown next to each section's name. */
  badges: Record<SectionId, string>;
}

/** Settings sections as plain links; the URL hash picks the section (settings-sections.ts). */
export const SettingsNav = (props: SettingsNavProps) => (
  <nav aria-label="Settings" data-settings-nav>
    <h1>React Grab</h1>
    <ul>
      <For each={SECTION_ORDER}>
        {(id) => (
          <li>
            <a
              href={`#${id}`}
              aria-current={props.active === id ? "page" : undefined}
            >
              <span>{SECTION_TITLES[id]}</span>
              <small data-badge={id}>{props.badges[id]}</small>
            </a>
          </li>
        )}
      </For>
    </ul>
  </nav>
);
