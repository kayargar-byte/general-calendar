<script setup>
import { onMounted, ref, watch } from "vue";
import { useTheme } from "../composables/useTheme.js";

const props = defineProps({
  open: { type: Boolean, required: true },
});
const emit = defineEmits(["close"]);

const dialogRef = ref(null);
const { theme, setTheme } = useTheme();

function showDialog() {
  if (dialogRef.value && !dialogRef.value.open) {
    dialogRef.value.showModal();
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
