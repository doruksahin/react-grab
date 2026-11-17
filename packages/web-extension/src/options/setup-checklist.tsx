import { For, Show } from "solid-js";
import { type SetupStep, isSetupDone } from "./setup-steps.js";

interface SetupChecklistProps {
  steps: SetupStep[];
}

/**
 * First-run steps, each linking to the section where it is done. A link to a
 * closed `<details>` opens it. Gone once every step is done.
 */
export const SetupChecklist = (props: SetupChecklistProps) => {
  const doneCount = () => props.steps.filter((step) => step.done).length;

  return (
    <Show when={!isSetupDone(props.steps)}>
      <section aria-labelledby="setup-heading" data-setup-checklist>
        <h2 id="setup-heading">Set up React Grab</h2>
        <p>
          {doneCount()} of {props.steps.length} done. Each step needs the one
          before it.
        </p>
        <ol>
          <For each={props.steps}>
            {(step) => (
              <li data-done={step.done}>
                <Show when={!step.done} fallback={<s>{step.title}</s>}>
                  <a href={`#${step.target}`}>{step.title}</a>
                </Show>
              </li>
            )}
          </For>
        </ol>
      </section>
    </Show>
  );
};
