<script setup>
import { nextTick, ref, watch } from "vue";
import { TAG_COLOR_PALETTE } from "../lib/calendar-catalog.js";
import TagEditDialog from "./TagEditDialog.vue";

const props = defineProps({
  calendars: { type: Array, required: true },
  visibleCalendarIds: { type: Set, required: true },
});
const emit = defineEmits([
  "toggle",
  "add-tag",
  "remove-tag",
  "reorder-tags",
  "update-tag",
  "macao-import",
]);

const addingTag = ref(false);
const newTagName = ref("");
const addError = ref("");
const newTagInputRef = ref(null);
const draggedTagId = ref(null);
const dropTargetId = ref(null);
const editingTag = ref(null);
const isTagEditOpen = ref(false);

function openEditTag(calendar) {
  editingTag.value = calendar;
  isTagEditOpen.value = true;
}

function handleTagSaved({ id, label, color }) {
  emit("update-tag", id, label, color);
  isTagEditOpen.value = false;
}

function onDragStart(id) {
  draggedTagId.value = id;
}

function onDragOver(id) {
  dropTargetId.value = id;
}

function onDrop(id) {
  if (draggedTagId.value && draggedTagId.value !== id) {
    emit("reorder-tags", draggedTagId.value, id);
  }

  draggedTagId.value = null;
  dropTargetId.value = null;
}

function onDragEnd() {
  draggedTagId.value = null;
  dropTargetId.value = null;
}

function autoResizeInput() {
  const input = newTagInputRef.value;

  if (!input) {
    return;
  }

  input.style.width = "0px";
  input.style.width = `${input.scrollWidth}px`;
}

watch(addingTag, (isAdding) => {
  if (isAdding) {
    nextTick(() => {
      autoResizeInput();
      newTagInputRef.value?.focus();
    });
  }
});

watch(newTagName, () => {
  autoResizeInput();
});

function confirmAddTag() {
  const label = newTagName.value.trim();

  if (!label) {
    addError.value = "分類名稱不可為空。";
    return;
  }

  if (props.calendars.some((calendar) => calendar.label === label)) {
    addError.value = `分類「${label}」已存在。`;
    return;
  }

  emit("add-tag", label);
  newTagName.value = "";
  addError.value = "";
  addingTag.value = false;
}

function cancelAddTag() {
  newTagName.value = "";
  addError.value = "";
  addingTag.value = false;
}
</script>

<template>
  <fieldset id="calendar-filters">
    <legend>我的日曆</legend>

    <div class="tag-toolbar">
      <button
        type="button"
        id="add-calendar-tag"
        class="add-calendar-tag"
        aria-label="新增分類"
        @click="addingTag = !addingTag"
      >
        ＋ 新增分類
      </button>
    </div>

    <div v-if="addingTag" class="tag-add-form">
      <input
        ref="newTagInputRef"
        id="new-calendar-tag-input"
        v-model="newTagName"
        type="text"
        placeholder="分類名稱"
        aria-label="分類名稱"
        @keydown.enter.prevent="confirmAddTag"
        @keydown.esc="cancelAddTag"
      />
      <button type="button" class="tag-add-confirm" @click="confirmAddTag">
        新增
      </button>
    </div>
    <p v-if="addError" class="tag-add-error" role="alert">{{ addError }}</p>

    <label
      v-for="calendar in calendars"
      :key="calendar.id"
      :data-calendar-id="calendar.id"
      :class="{
        'is-dragging': draggedTagId === calendar.id,
        'is-drop-target': dropTargetId === calendar.id,
      }"
      draggable="true"
      @dragstart="onDragStart(calendar.id)"
      @dragover.prevent="onDragOver(calendar.id)"
      @drop.prevent="onDrop(calendar.id)"
      @dragend="onDragEnd"
    >
      <input
        type="checkbox"
        :value="calendar.id"
        :checked="visibleCalendarIds.has(calendar.id)"
        :style="
          visibleCalendarIds.has(calendar.id)
            ? { backgroundColor: calendar.color }
            : undefined
        "
        @change="emit('toggle', calendar.id, $event.target.checked)"
      />
      <span class="tag-row-content">
        <span class="tag-row-label">{{ calendar.label }}</span>
        <span class="tag-row-actions">
          <button
            type="button"
            class="edit-calendar-tag"
            :data-calendar-id="calendar.id"
            :aria-label="`編輯分類 ${calendar.label}`"
            @click.stop="openEditTag(calendar)"
          >
            編輯
          </button>
          <button
            type="button"
            class="remove-calendar-tag"
            :data-calendar-id="calendar.id"
            :disabled="calendars.length <= 1"
            :aria-label="`刪除分類 ${calendar.label}`"
            @click.stop="emit('remove-tag', calendar.id)"
          >
            ×
          </button>
        </span>
      </span>
    </label>

    <button
      type="button"
      id="macao-one-account-import"
      class="macao-one-account-import"
      @click="emit('macao-import')"
    >
      一戶通資料匯入
    </button>
  </fieldset>

  <TagEditDialog
    :open="isTagEditOpen"
    :tag="editingTag"
    :calendars="calendars"
    :colors="TAG_COLOR_PALETTE"
    @save="handleTagSaved"
    @close="isTagEditOpen = false"
  />
</template>
