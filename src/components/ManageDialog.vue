<script setup>
import { onMounted, ref, watch } from "vue";
import { TAG_COLOR_PALETTE } from "../lib/calendar-catalog.js";
import { getDocuments } from "../lib/document-store.js";
import { getEvents } from "../lib/storage.js";
import { useCalendar } from "../composables/useCalendar.js";
import DocumentViewDialog from "./DocumentViewDialog.vue";
import TagEditDialog from "./TagEditDialog.vue";

const props = defineProps({
  open: { type: Boolean, required: true },
  calendars: { type: Array, required: true },
});
const emit = defineEmits([
  "close",
  "edit-event",
  "update-tag",
  "remove-tag",
  "jump-to-event",
  "changed",
]);

const dialogRef = ref(null);
const activeTab = ref("events");
const events = ref([]);
const documents = ref([]);
const editingTag = ref(null);
const isTagEditOpen = ref(false);
const viewDocId = ref("");
const isDocumentViewOpen = ref(false);
const { deleteEventWithCleanup, removeDocument } = useCalendar();

function loadEvents() {
  events.value = getEvents();
}

function loadDocuments() {
  documents.value = getDocuments();
}

function showDialog() {
  if (dialogRef.value && !dialogRef.value.open) {
    loadEvents();
    loadDocuments();
    dialogRef.value.showModal();
  }
}

function docEventCount(docId) {
  return events.value.filter((event) => event.sourceDocId === docId).length;
}

function openDocumentView(docId) {
  viewDocId.value = docId;
  isDocumentViewOpen.value = true;
}

async function handleRemoveDocument(doc) {
  if (!window.confirm(`確定要刪除文件「${doc.name}」及其所有事件嗎？`)) {
    return;
  }

  await removeDocument(doc.id);
  loadDocuments();
  emit("changed");
}

function handleDocumentJump(eventId) {
  isDocumentViewOpen.value = false;
  emit("jump-to-event", eventId);
}

function closeDialog() {
  if (dialogRef.value?.open) {
    dialogRef.value.close();
  }
}

function switchTab(tab) {
  activeTab.value = tab;
}

function handleEditEvent(event) {
  emit("edit-event", event.id);
}

async function handleRemoveEvent(event) {
  if (!window.confirm(`確定要刪除「${event.title}」嗎？`)) {
    return;
  }

  await deleteEventWithCleanup(event.id);
  loadEvents();
  // 文檔最後一個事件被刪時會連同文檔紀錄移除，一併刷新文件清單。
  loadDocuments();
  emit("changed");
}

function handleEditTag(calendar) {
  editingTag.value = calendar;
  isTagEditOpen.value = true;
}

function handleTagSaved({ id, label, color }) {
  emit("update-tag", id, label, color);
  isTagEditOpen.value = false;
}

function handleRemoveTag(calendar) {
  if (!window.confirm(`確定要刪除分類「${calendar.label}」嗎？`)) {
    return;
  }

  emit("remove-tag", calendar.id);
}

function formatDate(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  return match ? `${match[1]}/${match[2]}/${match[3]}` : dateKey;
}

function calendarColor(calendarId) {
  return props.calendars.find(
    (calendar) => calendar.id === calendarId,
  )?.color;
}

function calendarLabel(calendarId) {
  return props.calendars.find(
    (calendar) => calendar.id === calendarId,
  )?.label;
}

function eventCount(calendarId) {
  return events.value.filter((event) => event.calendarId === calendarId).length;
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
    id="manage-dialog"
    aria-labelledby="manage-title"
    @close="emit('close')"
  >
    <header class="dialog-header">
      <h2 id="manage-title">管理中心</h2>
      <button
        type="button"
        id="close-manage"
        aria-label="關閉"
        @click="closeDialog"
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>

    <div class="manage-tabs" role="tablist">
      <button
        type="button"
        id="manage-tab-events"
        class="manage-tab"
        :class="{ 'is-active': activeTab === 'events' }"
        :aria-selected="String(activeTab === 'events')"
        @click="switchTab('events')"
      >
        事件
      </button>
      <button
        type="button"
        id="manage-tab-tags"
        class="manage-tab"
        :class="{ 'is-active': activeTab === 'tags' }"
        :aria-selected="String(activeTab === 'tags')"
        @click="switchTab('tags')"
      >
        分類
      </button>
      <button
        type="button"
        id="manage-tab-documents"
        class="manage-tab"
        :class="{ 'is-active': activeTab === 'documents' }"
        :aria-selected="String(activeTab === 'documents')"
        @click="switchTab('documents')"
      >
        文件
      </button>
    </div>

    <div v-if="activeTab === 'events'" id="manage-events-panel">
      <p v-if="events.length === 0" class="manage-empty">沒有事件。</p>
      <div
        v-for="event in events"
        :key="event.id"
        class="manage-row"
        :style="{ '--row-color': calendarColor(event.calendarId) }"
      >
        <span class="manage-row-date">{{ formatDate(event.date) }}</span>
        <span class="manage-row-time">{{ event.startTime || "全天" }}</span>
        <span class="manage-row-title">{{ event.title }}</span>
        <span class="manage-row-label">{{ calendarLabel(event.calendarId) }}</span>
        <span class="manage-row-actions">
          <button
            type="button"
            class="manage-action-button"
            @click="handleEditEvent(event)"
          >
            編輯
          </button>
          <button
            type="button"
            class="manage-action-button is-danger"
            @click="handleRemoveEvent(event)"
          >
            刪除
          </button>
        </span>
      </div>
    </div>

    <div v-else-if="activeTab === 'tags'" id="manage-tags-panel">
      <p v-if="calendars.length === 0" class="manage-empty">沒有分類。</p>
      <div
        v-for="calendar in calendars"
        :key="calendar.id"
        class="manage-row manage-tag-row"
      >
        <span
          class="manage-row-swatch"
          :style="{ '--swatch-color': calendar.color }"
        ></span>
        <span class="manage-row-title">{{ calendar.label }}</span>
        <span class="manage-row-count">{{ eventCount(calendar.id) }} 筆</span>
        <span class="manage-row-actions">
          <button
            type="button"
            class="manage-action-button"
            @click="handleEditTag(calendar)"
          >
            編輯
          </button>
          <button
            type="button"
            class="manage-action-button is-danger"
            @click="handleRemoveTag(calendar)"
          >
            刪除
          </button>
        </span>
      </div>
    </div>

    <div v-else id="manage-documents-panel">
      <p v-if="documents.length === 0" class="manage-empty">沒有文件。</p>
      <div
        v-for="doc in documents"
        :key="doc.id"
        class="manage-row manage-doc-row"
        :title="`雙擊檢視「${doc.name}」`"
        @dblclick="openDocumentView(doc.id)"
      >
        <span class="manage-row-title">{{ doc.name }}</span>
        <span class="manage-row-count">{{ docEventCount(doc.id) }} 筆</span>
        <span class="manage-row-actions">
          <button
            type="button"
            class="manage-action-button"
            @click="openDocumentView(doc.id)"
          >
            檢視
          </button>
          <button
            type="button"
            class="manage-action-button is-danger"
            @click="handleRemoveDocument(doc)"
          >
            刪除
          </button>
        </span>
      </div>
    </div>

    <footer class="dialog-actions">
      <div></div>
      <div>
        <button type="button" id="close-manage-btn" @click="closeDialog">
          關閉
        </button>
      </div>
    </footer>

    <TagEditDialog
      :open="isTagEditOpen"
      :tag="editingTag"
      :calendars="calendars"
      :colors="TAG_COLOR_PALETTE"
      @save="handleTagSaved"
      @close="isTagEditOpen = false"
    />

    <DocumentViewDialog
      :open="isDocumentViewOpen"
      :doc-id="viewDocId"
      @close="isDocumentViewOpen = false"
      @jump="handleDocumentJump"
    />
  </dialog>
</template>
