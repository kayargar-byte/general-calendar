<script setup>
import { ref } from "vue";

defineProps({
  busy: { type: Boolean, default: false },
});
const emit = defineEmits(["files"]);

const fileInputRef = ref(null);

function openFilePicker() {
  fileInputRef.value?.click();
}

function handleFileChange(event) {
  const files = Array.from(event.target.files ?? []);

  if (files.length > 0) {
    emit("files", files);
  }

  // 重置 input，讓同一文件可以再次選擇
  event.target.value = "";
}
</script>

<template>
  <button
    type="button"
    id="import-document"
    @click="openFilePicker"
  >
    <span aria-hidden="true">⇪</span>
    匯入文檔
  </button>
  <input
    ref="fileInputRef"
    id="import-document-input"
    type="file"
    style="display: none"
    multiple
    accept=".docx,.pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.gif,.bmp"
    @change="handleFileChange"
  />
</template>
