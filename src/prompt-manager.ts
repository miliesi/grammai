import { el, getSettings, updateSettings, type CustomPrompt } from "./shared";

/** Shared by the inline assistant, sidebar and preferences. */
export function promptManager(prompts: CustomPrompt[], changed: () => void) {
  const root = el("div", "prompt-manager");
  const list = el("div", "prompt-list");
  const form = el("form", "prompt-form");
  const nameLabel = el("label", "", "Prompt name");
  const name = el("input", "prompt-field");
  name.type = "text";
  name.maxLength = 60;
  name.required = true;
  name.placeholder = "e.g. My LinkedIn voice";
  nameLabel.append(name);
  const instructionLabel = el("label", "", "Rewrite instructions");
  const instruction = el("textarea", "prompt-field");
  instruction.maxLength = 2000;
  instruction.rows = 3;
  instruction.required = true;
  instruction.placeholder =
    "Use short sentences, keep my tone and avoid buzzwords.";
  instructionLabel.append(instruction);
  let editing: string | undefined;
  const actions = el("div", "rewrite-actions");
  const save = el("button", "rewrite-primary", "Save prompt");
  save.type = "submit";
  const reset = el("button", "rewrite-secondary", "Cancel edit");
  reset.type = "button";
  reset.hidden = true;
  reset.onclick = () => {
    editing = undefined;
    form.reset();
    reset.hidden = true;
  };
  actions.append(save, reset);
  const status = el("p", "rewrite-note");
  status.setAttribute("role", "status");
  for (const prompt of prompts) {
    const row = el("div", "prompt-row");
    row.append(el("strong", "", prompt.name));
    const edit = el("button", "rewrite-secondary", "Edit");
    edit.type = "button";
    edit.setAttribute("aria-label", `Edit prompt ${prompt.name}`);
    edit.onclick = () => {
      editing = prompt.id;
      name.value = prompt.name;
      instruction.value = prompt.instruction;
      reset.hidden = false;
      name.focus();
    };
    const remove = el("button", "rewrite-secondary", "Delete");
    remove.type = "button";
    remove.setAttribute("aria-label", `Delete prompt ${prompt.name}`);
    remove.onclick = async () => {
      remove.disabled = true;
      try {
        const current = await getSettings();
        await updateSettings({
          customPrompts: current.customPrompts.filter(
            (p) => p.id !== prompt.id,
          ),
        });
        changed();
      } catch {
        status.textContent = "Could not delete this prompt. Try again.";
        remove.disabled = false;
      }
    };
    row.append(edit, remove);
    list.append(row);
  }
  form.append(nameLabel, instructionLabel, actions);
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!name.value.trim() || !instruction.value.trim()) {
      status.textContent = "Enter a name and rewrite instructions.";
      return;
    }
    save.disabled = true;
    try {
      const current = await getSettings();
      if (!editing && current.customPrompts.length >= 30)
        throw new Error(
          "You can save up to 30 prompts. Edit or delete one first.",
        );
      const prompt = {
        id: editing ?? crypto.randomUUID(),
        name: name.value.trim(),
        instruction: instruction.value.trim(),
      };
      await updateSettings({
        customPrompts: [
          ...current.customPrompts.filter((p) => p.id !== prompt.id),
          prompt,
        ],
      });
      changed();
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Could not save this prompt.";
      save.disabled = false;
    }
  };
  root.append(list, form, status);
  return root;
}
