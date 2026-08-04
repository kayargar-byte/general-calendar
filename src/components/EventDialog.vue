<script setup>
import { nextTick, onMounted, ref, watch } from "vue";
import {
  DEFAULT_CALENDAR_ID,
  getCalendars,
} from "../lib/calendar-catalog.js";
import {
  createEvent,
  deleteEvent,
  findConflicts,
  getEvents,
  updateEvent,
} from "../lib/storage.js";

const props = defineProps({
  open: { type: Boolean, required: true },
  editingEventId: { type: String, default: null },
  pendingDate: { type: String, default: "" },
  prefill: { type: Object, default: null },
  calendars: { type: Array, default: () => getCalendars() },
});
const emit = defineEmits(["saved", "deleted", "closed"]);

const dialogRef = ref(null);
const errorRef = ref(null);
const titleInputRef = ref(null);
const title = ref("");
const date = ref("");
const calendarId = ref(DEFAULT_CALENDAR_ID);
const startTime = ref("");
const endTime = ref("");
const notes = ref("");
const formErrorHidden = ref(true);
const formErrorMessage = ref("");
const conflictConfirmed = ref(false);

function clearFormError() {
  formErrorMessage.value = "";
  formErrorHidden.value = true;
}

function showFormError(error) {
  formErrorMessage.value =
    error instanceof Error ? error.message : "無法儲存事件。";
  formErrorHidden.value = false;
  nextTick(() => errorRef.value?.focus());
}

function populateForm() {
  const event = props.editingEventId
    ? getEvents().find(
        (storedEvent) => storedEvent.id === props.editingEventId,
      )
    : null;

  clearFormError();
  conflictConfirmed.value = false;

  if (event) {
    title.value = event.title;
    date.value = event.date;
    calendarId.value = event.calendarId;
    startTime.value = event.startTime;
    endTime.value = event.endTime;
    notes.value = event.notes;
  } else if (props.prefill) {
    title.value = props.prefill.title;
    date.value = props.prefill.date;
    calendarId.value = props.prefill.calendarId;
    startTime.value = props.prefill.startTime;
    endTime.value = props.prefill.endTime;
    notes.value = props.prefill.notes;
  } else {
    title.value = "";
    date.value = props.pendingDate;
    calendarId.value = props.calendars[0]?.id ?? DEFAULT_CALENDAR_ID;
    startTime.value = "";
    endTime.value = "";
    notes.value = "";
  }
}

function showDialog() {
  if (dialogRef.value && !dialogRef.value.open) {
    populateForm();
    dialogRef.value.showModal();
    nextTick(() => titleInputRef.value?.focus());
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

function handleSubmit() {
  clearFormError();

  try {
    const input = {
      title: title.value,
      date: date.value,
      calendarId: calendarId.value,
      startTime: startTime.value,
      endTime: endTime.value,
      notes: notes.value,
    };

    if (!conflictConfirmed.value) {
      const conflicts = findConflicts(input, props.editingEventId);

      if (conflicts.length > 0) {
        const conflictList = conflicts
          .map(
            (conflict) =>
              `「${conflict.title}」${conflict.startTime ? ` ${conflict.startTime}` : ""}`,
          )
          .join("、");
        showFormError(
          new Error(`時間衝突：${conflictList}。再次儲存以強制新增。`),
        );
        conflictConfirmed.value = true;
        return;
      }
    }

    if (props.editingEventId) {
      const updated = updateEvent(props.editingEventId, input);

      if (!updated) {
        throw new Error("找不到要更新的事件。");
      }
    } else {
      createEvent(input);
    }

    emit("saved");
  } catch (error) {
    showFormError(error);
  }
}

function handleDelete() {
  if (!props.editingEventId) {
    return;
  }

  const event = getEvents().find(
    (storedEvent) => storedEvent.id === props.editingEventId,
  );

  if (!event || !window.confirm(`確定要刪除「${event.title}」嗎？`)) {
    return;
  }

  deleteEvent(props.editingEventId);
  emit("deleted", event.date);
}
</script>

<template>
  <dialog
    ref="dialogRef"
    id="event-dialog"
    aria-labelledby="event-dialog-title"
    @close="emit('closed')"
  >
    <form id="event-form" novalidate @submit.prevent="handleSubmit">
      <header class="dialog-header">
        <h2 id="event-dialog-title">
          {{ editingEventId ? "編輯事件" : "新增事件" }}
        </h2>
        <button type="button" id="close-event-dialog" @click="closeDialog">
          關閉
        </button>
      </header>

      <p
        ref="errorRef"
        id="event-form-error"
        class="form-error"
        role="alert"
        tabindex="-1"
        :hidden="formErrorHidden"
      >
        {{ formErrorMessage }}
      </p>

      <label for="event-title">標題</label>
      <input
        ref="titleInputRef"
        id="event-title"
        name="title"
        type="text"
        required
        v-model="title"
      />

      <label for="event-date">日期</label>
      <input id="event-date" name="date" type="date" required v-model="date" />

      <label for="event-calendar">日曆</label>
      <select id="event-calendar" name="calendarId" v-model="calendarId">
        <option
          v-for="calendar in calendars"
          :key="calendar.id"
          :value="calendar.id"
        >
          {{ calendar.label }}
        </option>
      </select>

      <div class="time-fields">
        <div>
          <label for="event-start-time">開始時間</label>
          <input
            id="event-start-time"
            name="startTime"
            type="time"
            v-model="startTime"
          />
        </div>
        <div>
          <label for="event-end-time">結束時間</label>
          <input id="event-end-time" name="endTime" type="time" v-model="endTime" />
        </div>
      </div>

      <label for="event-notes">備註</label>
      <textarea id="event-notes" name="notes" rows="4" v-model="notes"></textarea>

      <footer class="dialog-actions">
        <button
          type="button"
          id="delete-event"
          class="danger-button"
          :hidden="!editingEventId"
          @click="handleDelete"
        >
          刪除
        </button>
        <div>
          <button type="button" id="cancel-event" @click="closeDialog">
            取消
          </button>
          <button type="submit">儲存</button>
        </div>
      </footer>
    </form>
  </dialog>
</template>
