<script setup>
import { onMounted, ref, watch } from "vue";
import { useTheme } from "../composables/useTheme.js";
import { getCalendars } from "../lib/calendar-catalog.js";
import {
  INTEREST_CATEGORIES,
  INTEREST_SUB_BRANCH_LABELS,
} from "../lib/interest-catalog.js";
import { getProfile, saveProfile } from "../lib/user-profile.js";

const props = defineProps({
  open: { type: Boolean, required: true },
});
const emit = defineEmits(["close"]);

// 身份資訊的下拉選項；空選項表示未填。
const OCCUPATION_OPTIONS = ["學生", "上班族", "自由職業", "退休", "其他"];
const AGE_GROUP_OPTIONS = [
  "18歲以下",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65歲以上",
];
const REGION_OPTIONS = ["澳門半島", "氹仔", "路環", "其他"];

const dialogRef = ref(null);
const { theme, setTheme } = useTheme();
const calendars = ref([]);
const priorityCalendarIds = ref([]);
const selectedInterests = ref([]);
const expandedCategoryIds = ref([]);
const interestsText = ref("");
const identity = ref({ occupation: "", ageGroup: "", region: "" });

// 開啟時重讀最新分類與已存畫像，回填表單（資料層見 src/lib/user-profile.js）。
function populate() {
  calendars.value = getCalendars();
  const prefs = getProfile();
  priorityCalendarIds.value = [...prefs.priorityCalendarIds];

  // 策展子分支由勾選器呈現；非策展的自訂項留在文字框（見 src/lib/interest-catalog.js）。
  selectedInterests.value = prefs.interests.filter((label) =>
    INTEREST_SUB_BRANCH_LABELS.has(label),
  );
  interestsText.value = prefs.interests
    .filter((label) => !INTEREST_SUB_BRANCH_LABELS.has(label))
    .join("\n");
  // 有勾選的大分支預設展開，其餘收合。
  expandedCategoryIds.value = INTEREST_CATEGORIES.filter((category) =>
    category.subBranches.some((label) =>
      selectedInterests.value.includes(label),
    ),
  ).map((category) => category.id);

  identity.value = {
    occupation: "",
    ageGroup: "",
    region: "",
    ...prefs.identity,
  };
}

function showDialog() {
  if (dialogRef.value && !dialogRef.value.open) {
    populate();
    dialogRef.value.showModal();
  }
}

function isPriority(calendarId) {
  return priorityCalendarIds.value.includes(calendarId);
}

// 優先分類以勾選順序表先後（先勾者優先）；取消即移除。
function togglePriority(calendarId, checked) {
  if (checked) {
    if (!isPriority(calendarId)) {
      priorityCalendarIds.value = [...priorityCalendarIds.value, calendarId];
    }
  } else {
    priorityCalendarIds.value = priorityCalendarIds.value.filter(
      (id) => id !== calendarId,
    );
  }
}

function saveProfileSettings() {
  const customInterests = interestsText.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // 勾選的子分支＋自訂行合併去重（勾選順序在前）。
  const interests = [
    ...new Set([...selectedInterests.value, ...customInterests]),
  ];

  saveProfile({
    priorityCalendarIds: priorityCalendarIds.value,
    interests,
    identity: identity.value,
  });
}

function isInterestSelected(label) {
  return selectedInterests.value.includes(label);
}

function toggleInterest(label) {
  if (isInterestSelected(label)) {
    selectedInterests.value = selectedInterests.value.filter(
      (item) => item !== label,
    );
  } else {
    selectedInterests.value = [...selectedInterests.value, label];
  }
}

function isCategoryExpanded(categoryId) {
  return expandedCategoryIds.value.includes(categoryId);
}

function toggleCategoryExpanded(categoryId) {
  if (isCategoryExpanded(categoryId)) {
    expandedCategoryIds.value = expandedCategoryIds.value.filter(
      (id) => id !== categoryId,
    );
  } else {
    expandedCategoryIds.value = [...expandedCategoryIds.value, categoryId];
  }
}

function isCategoryFullySelected(category) {
  return category.subBranches.every((label) => isInterestSelected(label));
}

// 全選／清除整組大分支的快捷（見計劃 Step 2）。
function toggleCategoryAll(category) {
  if (isCategoryFullySelected(category)) {
    selectedInterests.value = selectedInterests.value.filter(
      (label) => !category.subBranches.includes(label),
    );
  } else {
    const missing = category.subBranches.filter(
      (label) => !isInterestSelected(label),
    );
    selectedInterests.value = [...selectedInterests.value, ...missing];
  }
}

function closeDialog() {
  if (dialogRef.value?.open) {
    dialogRef.value.close();
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      showDialog();
    } else {
      closeDialog();
    }
  },
);

onMounted(() => {
  if (props.open) {
    showDialog();
  }
});
</script>

<template>
  <dialog
    ref="dialogRef"
    id="settings-dialog"
    aria-labelledby="settings-title"
    @close="emit('close')"
  >
    <header class="dialog-header">
      <h2 id="settings-title">設定</h2>
      <button
        type="button"
        id="close-settings"
        aria-label="關閉"
        @click="closeDialog"
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>

    <fieldset id="settings-theme">
      <legend>主題</legend>
      <label>
        <input
          type="radio"
          name="settings-theme"
          value="light"
          :checked="theme === 'light'"
          @change="setTheme('light')"
        />
        亮色
      </label>
      <label>
        <input
          type="radio"
          name="settings-theme"
          value="dark"
          :checked="theme === 'dark'"
          @change="setTheme('dark')"
        />
        暗色
      </label>
    </fieldset>

    <fieldset id="settings-profile">
      <legend>用戶畫像</legend>
      <p class="settings-profile-note">
        AI 搜索會依此偏置分類、個性化澄清選項並推薦相關主題；只送聚合摘要，不送具體事件內容。
      </p>

      <div class="profile-field">
        <span class="profile-field-label">優先分類（按勾選順序）</span>
        <label
          v-for="calendar in calendars"
          :key="calendar.id"
          class="profile-priority-option"
          :data-calendar-id="calendar.id"
        >
          <input
            type="checkbox"
            :checked="isPriority(calendar.id)"
            @change="togglePriority(calendar.id, $event.target.checked)"
          />
          {{ calendar.label }}
        </label>
      </div>

      <div class="profile-field">
        <span class="profile-field-label">興趣（大分類可多選）</span>
        <div id="interest-categories" class="interest-categories">
          <section
            v-for="category in INTEREST_CATEGORIES"
            :key="category.id"
            class="interest-category"
          >
            <button
              type="button"
              class="interest-category-header"
              :data-category-id="category.id"
              :aria-expanded="String(isCategoryExpanded(category.id))"
              @click="toggleCategoryExpanded(category.id)"
            >
              <span>{{ category.label }}</span>
              <span class="interest-category-toggle" aria-hidden="true">
                {{ isCategoryExpanded(category.id) ? "▾" : "▸" }}
              </span>
            </button>
            <div
              v-if="isCategoryExpanded(category.id)"
              class="interest-sub-branches"
            >
              <label
                v-for="subBranch in category.subBranches"
                :key="subBranch"
                class="interest-sub-branch-option"
                :data-interest-label="subBranch"
              >
                <input
                  type="checkbox"
                  :checked="isInterestSelected(subBranch)"
                  @change="toggleInterest(subBranch)"
                />
                {{ subBranch }}
              </label>
              <button
                type="button"
                class="interest-category-all"
                @click="toggleCategoryAll(category)"
              >
                {{ isCategoryFullySelected(category) ? "清除全部" : "全選" }}
              </button>
            </div>
          </section>
        </div>
      </div>

      <div class="profile-field">
        <label class="profile-field-label" for="profile-interests">
          其他興趣（每行一項，不在上方選項中）
        </label>
        <textarea
          id="profile-interests"
          v-model="interestsText"
          rows="3"
          placeholder="如：葡語學習、寵物美容"
        ></textarea>
      </div>

      <div class="profile-field">
        <label class="profile-field-label" for="profile-occupation">職業</label>
        <select id="profile-occupation" v-model="identity.occupation">
          <option value="">未填</option>
          <option
            v-for="option in OCCUPATION_OPTIONS"
            :key="option"
            :value="option"
          >
            {{ option }}
          </option>
        </select>
      </div>

      <div class="profile-field">
        <label class="profile-field-label" for="profile-age-group">年齡層</label>
        <select id="profile-age-group" v-model="identity.ageGroup">
          <option value="">未填</option>
          <option
            v-for="option in AGE_GROUP_OPTIONS"
            :key="option"
            :value="option"
          >
            {{ option }}
          </option>
        </select>
      </div>

      <div class="profile-field">
        <label class="profile-field-label" for="profile-region">居住地區</label>
        <select id="profile-region" v-model="identity.region">
          <option value="">未填</option>
          <option
            v-for="option in REGION_OPTIONS"
            :key="option"
            :value="option"
          >
            {{ option }}
          </option>
        </select>
      </div>

      <button type="button" id="save-profile" @click="saveProfileSettings">
        儲存畫像
      </button>
    </fieldset>

    <footer class="dialog-actions">
      <div></div>
      <div>
        <button type="button" id="close-settings-btn" @click="closeDialog">
          關閉
        </button>
      </div>
    </footer>
  </dialog>
</template>
