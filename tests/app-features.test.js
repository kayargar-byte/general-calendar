import assert from "node:assert/strict";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { test } from "vitest";
import App from "../src/App.vue";

const THEME_STORAGE_KEY = "general-calendar.theme.v1";

test("theme toggle and settings radio switch and persist", async () => {
  localStorage.clear();
  const wrapper = mount(App, { attachTo: document.body });

  await wrapper.find("#theme-toggle").trigger("click");
  await nextTick();
  assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
  assert.equal(localStorage.getItem(THEME_STORAGE_KEY), "dark");

  await wrapper.find("#open-settings").trigger("click");
  await nextTick();

  await wrapper
    .find('input[name="settings-theme"][value="light"]')
    .setValue(true);
  await nextTick();
  assert.equal(document.documentElement.getAttribute("data-theme"), null);
  assert.equal(localStorage.getItem(THEME_STORAGE_KEY), "light");

  await wrapper
    .find('input[name="settings-theme"][value="dark"]')
    .setValue(true);
  await nextTick();
  assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
  assert.equal(localStorage.getItem(THEME_STORAGE_KEY), "dark");

  wrapper.unmount();
});

test("date picker jumps to the selected month", async () => {
  localStorage.clear();
  const wrapper = mount(App, { attachTo: document.body });

  await wrapper.find("#calendar-title").trigger("click");
  await nextTick();

  assert.equal(wrapper.find("#date-picker-popover").exists(), true);

  await wrapper.find("#date-picker-month").setValue("11");
  await wrapper.find("#date-picker-confirm").trigger("click");
  await nextTick();

  assert.match(wrapper.find("#calendar-title").text(), /2026年12月/);

  wrapper.unmount();
});

test("Macao One Account entry opens the local document import consent dialog", async () => {
  localStorage.clear();
  const wrapper = mount(App, { attachTo: document.body });

  await wrapper.find("#macao-one-account-import").trigger("click");
  await nextTick();

  const dialog = wrapper.find("#macao-one-account-import-dialog");
  assert.equal(dialog.element.open, true);
  assert.match(dialog.text(), /不需要登入一戶通/);
  assert.equal(wrapper.find("#choose-macao-one-account-file").exists(), false);

  wrapper.unmount();
});

test("Macao One Account dialog links to the official sign-in service", async () => {
  localStorage.clear();
  const wrapper = mount(App, { attachTo: document.body });

  await wrapper.find("#macao-one-account-import").trigger("click");
  await nextTick();

  const loginLink = wrapper.find("#open-macao-one-account-login");
  assert.equal(
    loginLink.attributes("href"),
    "https://mo.gov.mo/home",
  );
  assert.equal(loginLink.attributes("target"), "_blank");
  assert.equal(wrapper.find("#choose-macao-one-account-file").exists(), false);

  wrapper.unmount();
});

test("Macao One Account guide moves from login to download instructions", async () => {
  localStorage.clear();
  const wrapper = mount(App, { attachTo: document.body });

  await wrapper.find("#macao-one-account-import").trigger("click");
  await nextTick();

  assert.equal(wrapper.find("#macao-import-current-step").text(), "1");
  assert.ok(wrapper.find("#macao-import-login-complete").exists());

  await wrapper.find("#macao-import-login-complete").trigger("click");
  await nextTick();

  assert.equal(wrapper.find("#macao-import-current-step").text(), "2");
  assert.match(
    wrapper.find("#macao-one-account-import-dialog").text(),
    /下載/,
  );

  wrapper.unmount();
});
