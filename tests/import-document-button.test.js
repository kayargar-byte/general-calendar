import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import { test, vi } from "vitest";
import ImportDocumentButton from "../src/components/ImportDocumentButton.vue";

function selectFiles(wrapper, files) {
  const input = wrapper.find("#import-document-input");
  Object.defineProperty(input.element, "files", {
    value: files,
    configurable: true,
  });
  return input;
}

test("renders the import button with a hidden file input", () => {
  const wrapper = mount(ImportDocumentButton);

  assert.ok(wrapper.find("#import-document").exists());
  assert.equal(wrapper.find("#import-document-input").element.style.display, "none");
});

test("clicking the button opens the file picker", async () => {
  const wrapper = mount(ImportDocumentButton);
  const input = wrapper.find("#import-document-input");
  const clickSpy = vi.spyOn(input.element, "click").mockImplementation(() => {});

  await wrapper.find("#import-document").trigger("click");

  assert.equal(clickSpy.mock.calls.length, 1);
});

test("supports selecting and emitting every selected file", async () => {
  const wrapper = mount(ImportDocumentButton);
  const first = new File(["content"], "sample.docx", {
    type: "application/pdf",
  });
  const second = new File(["content"], "schedule.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const input = selectFiles(wrapper, [first, second]);

  await input.trigger("change");

  assert.equal(input.attributes("multiple"), "");
  assert.deepEqual(wrapper.emitted("files")[0][0], [first, second]);
});

test("resets the input so the same file can be re-selected", async () => {
  const wrapper = mount(ImportDocumentButton);
  const input = selectFiles(
    wrapper,
    [new File(["x"], "a.pdf", { type: "application/pdf" })],
  );

  await input.trigger("change");

  assert.equal(input.element.value, "");
});

test("keeps the picker enabled while analysis is in progress", async () => {
  const wrapper = mount(ImportDocumentButton, { props: { busy: true } });
  const input = selectFiles(wrapper, []);

  await input.trigger("change");

  assert.equal(wrapper.find("#import-document").attributes("disabled"), undefined);
  assert.equal(input.attributes("disabled"), undefined);
  assert.equal(wrapper.emitted("files"), undefined);
});
