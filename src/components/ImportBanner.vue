<script setup>
defineProps({
  open: { type: Boolean, required: true },
  count: { type: Number, default: 0 },
  docName: { type: String, default: "" },
  error: { type: String, default: "" },
});
const emit = defineEmits(["undo", "close"]);
</script>

<template>
  <div
    v-if="open"
    id="import-banner"
    class="import-banner"
    role="status"
    aria-live="polite"
  >
    <span
      v-if="error"
      id="import-banner-error"
      class="import-banner-error"
      role="alert"
    >
      {{ error }}
    </span>
    <span v-else class="import-banner-message">
      已匯入 {{ count }} 筆{{ docName ? `（來源：${docName}）` : "" }}
    </span>
    <div class="import-banner-actions">
      <button
        v-if="!error"
        type="button"
        id="undo-import"
        @click="emit('undo')"
      >
        撤銷
      </button>
      <button
        type="button"
        id="close-import-banner"
        aria-label="關閉"
        @click="emit('close')"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  </div>
</template>
