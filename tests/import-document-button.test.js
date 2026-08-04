import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import { test, vi } from "vitest";
import ImportDocumentButton from "../src/components/ImportDocumentButton.vue";

function selectFile(wrapper, file) {
  const input = wrapper.find("#import-document-input");
  Object.defineProperty(input.element, "files", {
    value: file ? [file] : [],
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

test("emits file when a file is selected", async () => {
  const wrapper = mount(ImportDocumentButton);
  const file = new File(["content"], "sample.docx", {
    type: "application/pdf",
  });
  const input = selectFile(wrapper, file);

  await input.trigger("change");

  assert.equal(wrapper.emitted("file")[0][0], file);
});

test("resets the input so the same file can be re-selected", async () => {
  const wrapper = mount(ImportDocumentButton);
  const input = selectFile(
    wrapper,
    new File(["x"], "a.pdf", { type: "application/pdf" }),
  );

  await input.trigger("change");

  assert.equal(input.element.value, "");
});

test("does not emit when no file is selected", async () => {
  const wrapper = mount(ImportDocumentButton);
  const input = selectFile(wrapper, null);

  await input.trigger("change");

  assert.equal(wrapper.emitted("file"), undefined);
});
