<script setup>
import { nextTick, onMounted, ref, watch } from "vue";

const props = defineProps({
  open: { type: Boolean, required: true },
  tag: { type: Object, default: null },
  calendars: { type: Array, required: true },
  colors: { type: Array, required: true },
});
const emit = defineEmits(["save", "close"]);

const dialogRef = ref(null);
const nameInputRef = ref(null);
const name = ref("");
const color = ref("");
const error = ref("");
const errorHidden = ref(true);

function clearError() {
  error.value = "";
  errorHidden.value = true;
}

function showError(message) {
  error.value = message;
  errorHidden.value = false;
}

function selectColor(selected) {
  color.value = selected;
}

function populate() {
  clearError();
  name.value = props.tag?.label ?? "";
  color.value = props.tag?.color ?? props.colors[0];
}

function showDialog() {
  if (dialogRef.value && !dialogRef.value.open) {
    populate();
    dialogRef.value.showModal();
    nextTick(() => nameInputRef.value?.focus());
  }
}

function closeDialog() {
  if (dialogRef.value?.open) {
    dialogRef.value.close();
  }
}

function handleSave() {
  clearError();

  const label = name.value.trim();

  if (!label) {
    showError("分類名稱不可為空。");
    return;
  }

  if (
    props.calendars.some(
      (calendar) => calendar.id !== props.tag.id && calendar.label === label,
    )
  ) {
    showError(`分類「${label}」已存在。`);
    return;
  }

  emit("save", { id: props.tag.id, label, color: color.value });
  closeDialog();
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
    id="tag-edit-dialog"
    aria-labelledby="tag-edit-title"
    @close="emit('close')"
  >
    <form id="tag-edit-form" novalidate @submit.prevent="handleSave">
      <header class="dialog-header">
        <h2 id="tag-edit-title">編輯分類</h2>
        <button
          type="button"
          id="close-tag-edit"
          aria-label="關閉"
          @click="closeDialog"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <label for="tag-edit-name">名稱</label>
      <input
        ref="nameInputRef"
        id="tag-edit-name"
        name="label"
        type="text"
        required
        v-model="name"
      />

      <fieldset class="tag-color-palette">
        <legend>顏色</legend>
        <button
          v-for="candidate in colors"
          :key="candidate"
          type="button"
          class="tag-color-swatch"
          :class="{ 'is-selected': color === candidate }"
          :style="{ '--swatch-color': candidate }"
          :aria-checked="String(color === candidate)"
          role="radio"
          @click="selectColor(candidate)"
        ></button>
      </fieldset>

      <p
        id="tag-edit-error"
        class="form-error"
        role="alert"
        tabindex="-1"
        :hidden="errorHidden"
      >
        {{ error }}
      </p>

      <footer class="dialog-actions">
        <div></div>
        <div>
          <button type="button" id="cancel-tag-edit" @click="closeDialog">
            取消
          </button>
          <button type="submit">儲存</button>
        </div>
      </footer>
    </form>
  </dialog>
</template>
