<script setup>
defineProps({
  question: { type: String, default: "" },
  options: { type: Array, default: () => [] },
});
const emit = defineEmits(["select"]);
</script>

<template>
  <div class="ai-clarify" role="group" aria-label="澄清問題">
    <p class="ai-clarify-question">{{ question }}</p>
    <div class="ai-clarify-options">
      <button
        v-for="(option, index) in options"
        :key="index"
        type="button"
        class="ai-clarify-option"
        @click="emit('select', option)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
