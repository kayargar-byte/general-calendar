import assert from "node:assert/strict";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, test } from "vitest";
import SettingsDialog from "../src/components/SettingsDialog.vue";
import { getProfile } from "../src/lib/user-profile.js";

afterEach(() => {
  localStorage.clear();
});

// populate 在 onMounted 寫入的 ref 由 Vue 非同步 flush，須等 promise 排空再查 DOM。
async function mountDialog() {
  const wrapper = mount(SettingsDialog, { props: { open: true } });
  await flushPromises();
  return wrapper;
}

test("SettingsDialog saves the profile to localStorage on submit", async () => {
  const wrapper = await mountDialog();

  // 優先分類：依勾選順序表先後。
  await wrapper.find('[data-calendar-id="medical"] input').setValue(true);
  await wrapper.find('[data-calendar-id="work"] input').setValue(true);
  await wrapper.find("#profile-interests").setValue("政府補助\n足球");
  await wrapper.find("#profile-occupation").setValue("上班族");
  await wrapper.find("#profile-age-group").setValue("25-34");
  await wrapper.find("#profile-region").setValue("澳門半島");

  await wrapper.find("#save-profile").trigger("click");

  assert.deepEqual(getProfile(), {
    priorityCalendarIds: ["medical", "work"],
    interests: ["政府補助", "足球"],
    identity: { occupation: "上班族", ageGroup: "25-34", region: "澳門半島" },
  });
});

test("SettingsDialog repopulates the form from the saved profile on reopen", async () => {
  const wrapper = await mountDialog();

  await wrapper.find('[data-calendar-id="medical"] input').setValue(true);
  await wrapper.find("#profile-interests").setValue("足球");
  await wrapper.find("#profile-occupation").setValue("學生");
  await wrapper.find("#save-profile").trigger("click");

  // 關閉再開啟：應回填已存值。
  await wrapper.setProps({ open: false });
  await wrapper.setProps({ open: true });
  await flushPromises();

  assert.ok(wrapper.find('[data-calendar-id="medical"] input').element.checked);
  assert.equal(wrapper.find("#profile-interests").element.value, "足球");
  assert.equal(wrapper.find("#profile-occupation").element.value, "學生");
});

test("SettingsDialog splits interests on newlines and ignores blank lines", async () => {
  const wrapper = await mountDialog();

  await wrapper.find("#profile-interests").setValue("  政府補助  \n\n足球\n ");
  await wrapper.find("#save-profile").trigger("click");

  assert.deepEqual(getProfile().interests, ["政府補助", "足球"]);
});

test("SettingsDialog saves an empty profile when nothing is filled", async () => {
  const wrapper = await mountDialog();

  await wrapper.find("#save-profile").trigger("click");

  assert.deepEqual(getProfile(), {
    priorityCalendarIds: [],
    interests: [],
    identity: {},
  });
});

test("SettingsDialog saves selected interest sub-branches into the profile", async () => {
  const wrapper = await mountDialog();

  // 展開「醫療健康」並勾選兩個小分支。
  await wrapper.find('[data-category-id="medical"]').trigger("click");
  await wrapper.find('[data-interest-label="疫苗接種"] input').setValue(true);
  await wrapper.find('[data-interest-label="健康檢查"] input').setValue(true);

  await wrapper.find("#save-profile").trigger("click");

  assert.deepEqual(getProfile().interests, ["疫苗接種", "健康檢查"]);
});

test("SettingsDialog merges picker selections with custom text and deduplicates", async () => {
  const wrapper = await mountDialog();

  await wrapper.find('[data-category-id="medical"]').trigger("click");
  await wrapper.find('[data-interest-label="疫苗接種"] input').setValue(true);
  // 自訂文字與勾選相同項應去重。
  await wrapper.find("#profile-interests").setValue("疫苗接種\n葡語學習");

  await wrapper.find("#save-profile").trigger("click");

  assert.deepEqual(getProfile().interests, ["疫苗接種", "葡語學習"]);
});

test("SettingsDialog repopulates the picker and keeps custom text separate", async () => {
  const wrapper = await mountDialog();

  await wrapper.find('[data-category-id="medical"]').trigger("click");
  await wrapper.find('[data-interest-label="疫苗接種"] input').setValue(true);
  await wrapper.find("#profile-interests").setValue("葡語學習");
  await wrapper.find("#save-profile").trigger("click");

  await wrapper.setProps({ open: false });
  await wrapper.setProps({ open: true });
  await flushPromises();

  // 勾選回填在 picker（大分支因有勾選而展開）；自訂留在文字框。
  assert.ok(
    wrapper.find('[data-interest-label="疫苗接種"] input').element.checked,
  );
  assert.equal(wrapper.find("#profile-interests").element.value, "葡語學習");
});

test("SettingsDialog selects all sub-branches of a category with the all toggle", async () => {
  const wrapper = await mountDialog();

  await wrapper.find('[data-category-id="culture"]').trigger("click");
  await wrapper.find(".interest-category-all").trigger("click");

  await wrapper.find("#save-profile").trigger("click");

  assert.deepEqual(getProfile().interests, [
    "展覽／博物館",
    "演唱會／音樂",
    "電影／戲劇",
    "藝文課程",
  ]);
});
