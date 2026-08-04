<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as pdfjs from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";
import {
  getDocument,
  getDocumentBlob,
  getDocumentText,
} from "../lib/document-store.js";
import { getEvents } from "../lib/storage.js";
import {
  findQuoteMatches,
  splitTextIntoSections,
} from "../lib/document-text.js";

// pdf.js 以 worker 背景線程渲染，避免阻塞主線程（Vite ?worker 會打包 worker asset）。
pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();

const props = defineProps({
  open: { type: Boolean, required: true },
  docId: { type: String, default: "" },
});
const emit = defineEmits(["close", "jump"]);

const dialogRef = ref(null);
const isLoading = ref(false);
const loadError = ref("");
const doc = ref(null);
const textContent = ref("");
const pdfImageUrls = ref([]);
const imageUrl = ref("");

// 依 mimeType 決定檢視方式：PDF 渲染影像、圖片顯示原圖、其餘顯示規則分段文本。
const docKind = computed(() => {
  if (doc.value?.mimeType === "application/pdf") {
    return "pdf";
  }

  if (doc.value?.mimeType.startsWith("image/")) {
    return "image";
  }

  return "text";
});

const relatedEvents = computed(() =>
  props.docId
    ? getEvents().filter((event) => event.sourceDocId === props.docId)
    : [],
);

const relatedQuotes = computed(() =>
  relatedEvents.value
    .map((event) => event.sourceQuote)
    .filter((quote) => typeof quote === "string" && quote),
);

const sections = computed(() => splitTextIntoSections(textContent.value));

function sectionHasQuote(section) {
  return findQuoteMatches(section, relatedQuotes.value).length > 0;
}

function formatSize(bytes) {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatImportedAt(value) {
  if (typeof value !== "string") {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function revokeImageUrl() {
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
    imageUrl.value = "";
  }
}

function reset() {
  isLoading.value = false;
  loadError.value = "";
  doc.value = null;
  textContent.value = "";
  pdfImageUrls.value = [];
  revokeImageUrl();
}

async function renderPdf(blob) {
  const pdf = await pdfjs
    .getDocument({ data: await blob.arrayBuffer() })
    .promise;
  const urls = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
    const page = await pdf.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context, viewport }).promise;
    urls.push(canvas.toDataURL("image/png"));
  }

  pdfImageUrls.value = urls;
}

async function loadContent() {
  const docRecord = getDocument(props.docId);

  if (!docRecord) {
    loadError.value = "找不到此文件的記錄。";
    return;
  }

  doc.value = docRecord;

  if (docKind.value === "text") {
    const text = await getDocumentText(docRecord.id);
    textContent.value = text ?? "";
    return;
  }

  const blob = await getDocumentBlob(docRecord.id);

  if (!blob) {
    loadError.value = "找不到此文件的原檔。";
    return;
  }

  if (docKind.value === "pdf") {
    await renderPdf(blob);
  } else {
    revokeImageUrl();
    imageUrl.value = URL.createObjectURL(blob);
  }
}

async function load() {
  if (!props.docId) {
    return;
  }

  reset();
  isLoading.value = true;

  try {
    await loadContent();
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : "無法載入原檔。";
  } finally {
    isLoading.value = false;
  }
}

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
      load();
    } else {
      closeDialog();
    }
  },
);

watch(
  () => props.docId,
  () => {
    if (props.open) {
      load();
    }
  },
);

onMounted(() => {
  if (props.open) {
    showDialog();
    load();
  }
});

onBeforeUnmount(() => {
  revokeImageUrl();
});
</script>

<template>
  <dialog
    ref="dialogRef"
    id="document-view-dialog"
    class="document-view-dialog"
    aria-labelledby="document-view-title"
    @close="emit('close')"
  >
    <header class="dialog-header">
      <div>
        <h2 id="document-view-title">{{ doc?.name ?? "檢視原檔" }}</h2>
        <p v-if="doc" class="doc-meta">
          {{ doc.mimeType }} · {{ formatSize(doc.size) }}
          <span v-if="formatImportedAt(doc.importedAt)">
            · {{ formatImportedAt(doc.importedAt) }} 匯入
          </span>
        </p>
      </div>
      <button
        type="button"
        id="close-document-view"
        aria-label="關閉"
        @click="closeDialog"
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>

    <p
      v-if="isLoading"
      id="document-view-loading"
      class="doc-loading"
      role="status"
    >
      載入中…
    </p>

    <p
      v-else-if="loadError"
      id="document-view-error"
      class="form-error"
      role="alert"
    >
      {{ loadError }}
    </p>

    <div
      v-else-if="docKind === 'text'"
      id="document-view-text"
      class="doc-text-view"
    >
      <p v-if="textContent === ''" class="doc-empty">
        此文件沒有可顯示的文本（可能為舊紀錄或掃描檔）。
      </p>
      <p
        v-for="(section, index) in sections"
        v-else
        :key="index"
        class="doc-section"
        :class="{ 'is-quote': sectionHasQuote(section) }"
      >
        {{ section }}
      </p>
    </div>

    <div
      v-else-if="docKind === 'pdf'"
      id="document-view-pdf"
      class="doc-pdf-view"
    >
      <img
        v-for="(url, index) in pdfImageUrls"
        :key="index"
        :src="url"
        :alt="`PDF 第 ${index + 1} 頁`"
        class="doc-pdf-page"
      />
    </div>

    <img
      v-else-if="docKind === 'image' && imageUrl"
      id="document-view-image"
      class="doc-image-view"
      :src="imageUrl"
      :alt="doc?.name ?? '原圖'"
    />

    <section
      v-if="relatedQuotes.length > 0"
      class="doc-quotes"
      aria-labelledby="document-view-quotes-title"
    >
      <h3 id="document-view-quotes-title">事件引用</h3>
      <blockquote
        v-for="(quote, index) in relatedQuotes"
        :key="index"
        class="doc-quote"
      >
        {{ quote }}
      </blockquote>
    </section>

    <section
      v-if="relatedEvents.length > 0"
      class="doc-events"
      aria-labelledby="document-view-events-title"
    >
      <h3 id="document-view-events-title">關聯事件</h3>
      <button
        v-for="event in relatedEvents"
        :key="event.id"
        type="button"
        class="doc-event-button"
        @click="emit('jump', event.id)"
      >
        {{ event.date }}
        <span v-if="event.startTime"> {{ event.startTime }}</span>
        <span v-else> 全天</span>
        · {{ event.title }}
      </button>
    </section>

    <footer class="dialog-actions">
      <div></div>
      <div>
        <button
          type="button"
          id="close-document-view-btn"
          @click="closeDialog"
        >
          關閉
        </button>
      </div>
    </footer>
  </dialog>
</template>
