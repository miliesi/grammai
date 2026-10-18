/** Open on demand with the same shortcut available to users. */
export async function openAssistant(page, editor, assistant) {
  await editor.focus();
  if (!(await assistant.locator(".panel").count())) {
    await page.keyboard.press("ControlOrMeta+Shift+Y");
    await assistant.locator(".panel").waitFor({ state: "visible" });
  }
}
export async function translateFromPanel(assistant) {
  await assistant.getByRole("tab", { name: "Translate", exact: true }).click();
  await assistant
    .getByRole("button", { name: "Translate", exact: true })
    .click();
}
