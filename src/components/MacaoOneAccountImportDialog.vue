<script setup>
import { nextTick, onMounted, ref, watch } from "vue";

const props = defineProps({
  open: { type: Boolean, required: true },
  busy: { type: Boolean, default: false },
  error: { type: String, default: "" },
});
const emit = defineEmits(["file", "close"]);

const dialogRef = ref(null);
const fileInputRef = ref(null);
const currentStep = ref(1);

function showDialog() {
  currentStep.value = 1;
  if (dialogRef.value && !dialogRef.value.open) {
    dialogRef.value.showModal();
  }
}

function closeDialog() {
  if (dialogRef.value?.open) {
    dialogRef.value.close();
  }
}

function goToStep(step) {
  currentStep.value = step;
}

function openFilePicker() {
  fileInputRef.value?.click();
}

function handleFileChange(event) {
  const file = event.target.files?.[0];

  if (file) {
    currentStep.value = 4;
    emit("file", file);
  }

  event.target.value = "";
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

watch(
  () => props.error,
  (error) => {
    if (error && currentStep.value === 4) {
      currentStep.value = 3;
    }
  },
);

onMounted(() => {
  if (props.open) {
    showDialog();
  }
  nextTick(() => dialogRef.value?.focus());
});
</script>

<template>
  <dialog
    ref="dialogRef"
    id="macao-one-account-import-dialog"
    aria-labelledby="macao-one-account-import-title"
    @close="emit('close')"
  >
    <header class="dialog-header">
      <div>
        <p class="macao-import-eyebrow">一戶通資料匯入</p>
        <h2 id="macao-one-account-import-title">用四步建立日程</h2>
      </div>
      <button
        type="button"
        id="close-macao-one-account-import"
        aria-label="關閉"
        @click="closeDialog"
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>

    <ol class="macao-import-progress" aria-label="匯入進度">
      <li :class="{ 'is-current': currentStep === 1, 'is-done': currentStep > 1 }">
        <span>1</span>登入
      </li>
      <li :class="{ 'is-current': currentStep === 2, 'is-done': currentStep > 2 }">
        <span>2</span>下載
      </li>
      <li :class="{ 'is-current': currentStep === 3, 'is-done': currentStep > 3 }">
        <span>3</span>導入
      </li>
      <li :class="{ 'is-current': currentStep === 4 }">
        <span>4</span>完成
      </li>
    </ol>
    <p id="macao-import-current-step" class="macao-import-current-step" aria-live="polite">
      {{ currentStep }}
    </p>

    <section v-if="currentStep === 1" class="macao-import-step">
      <p class="macao-import-step-number">第一步</p>
      <h3>登入一戶通</h3>
      <p>登入會在一戶通服務首頁的新分頁完成；日曆不會接觸你的帳號或密碼。</p>
      <a
        id="open-macao-one-account-login"
        class="macao-import-primary"
        href="https://mo.gov.mo/home"
        target="_blank"
        rel="noopener noreferrer"
      >
        前往一戶通服務首頁
      </a>
      <button
        type="button"
        id="macao-import-login-complete"
        class="macao-import-secondary"
        @click="goToStep(2)"
      >
        我已登入
      </button>
    </section>

    <section v-else-if="currentStep === 2" class="macao-import-step">
      <p class="macao-import-step-number">第二步</p>
      <h3>下載需要提醒的文件</h3>
      <p>在一戶通內開啟相關服務，下載通知、回執或證明文件。</p>
      <p class="macao-import-hint">只選擇你希望建立日程的文件即可。</p>
      <div class="macao-import-actions">
        <button type="button" class="macao-import-secondary" @click="goToStep(1)">上一步</button>
        <button type="button" id="macao-import-download-complete" class="macao-import-primary" @click="goToStep(3)">我已下載文件</button>
      </div>
    </section>

    <section v-else-if="currentStep === 3" class="macao-import-step">
      <p class="macao-import-step-number">第三步</p>
      <h3>導入文件</h3>
      <p>支援 PDF、Word、Excel 和常見圖片格式，單一文件不可超過 10MB。</p>
      <p v-if="error" class="macao-import-error" role="alert">{{ error }}</p>
      <div class="macao-import-actions">
        <button type="button" class="macao-import-secondary" @click="goToStep(2)">上一步</button>
        <button
          type="button"
          id="choose-macao-one-account-file"
          class="macao-import-primary"
          :disabled="busy"
          @click="openFilePicker"
        >
          選擇已下載文件
        </button>
      </div>
    </section>

    <section v-else class="macao-import-step macao-import-complete">
      <p class="macao-import-step-number">第四步</p>
      <h3>{{ busy ? "正在分析文件" : "日程已建立" }}</h3>
      <p>{{ busy ? "正在擷取日期和事項，請稍候。" : "已將可確認的事項加入日曆。" }}</p>
      <button
        type="button"
        id="macao-import-view-calendar"
        class="macao-import-primary"
        :disabled="busy"
        @click="closeDialog"
      >
        查看日曆
      </button>
    </section>

    <input
      ref="fileInputRef"
      id="macao-one-account-import-input"
      type="file"
      style="display: none"
      accept=".docx,.pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.gif,.bmp"
      @change="handleFileChange"
    />

    <button
      v-show="currentStep === 3"
      type="button"
      id="choose-macao-one-account-file-legacy"
      style="display: none"
      aria-hidden="true"
    ></button>

    <footer class="dialog-actions">
      <p>日曆不需要登入一戶通帳號。</p>
      <button type="button" id="cancel-macao-one-account-import" @click="closeDialog">取消</button>
    </footer>
  </dialog>
</template>
