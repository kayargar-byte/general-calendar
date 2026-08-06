import { computed, nextTick, ref } from "vue";
import { formatMonthTitle } from "../lib/date-utils.js";
import { buildCalendarView } from "../lib/buildCalendarView.js";
import {
  createCalendar,
  deleteCalendar,
  getCalendars,
  saveCalendars,
  updateCalendar,
} from "../lib/calendar-catalog.js";
import {
  createEvent,
  deleteEvent,
  getEvents,
  reassignEventsCalendar,
} from "../lib/storage.js";
import { analyzeDocument, normalizeParsedEvents } from "../lib/ai.js";
import {
  createDocument,
  deleteDocument,
  deleteDocumentBlob,
  deleteDocumentText,
  getDocument,
  saveDocumentBlob,
  saveDocumentText,
} from "../lib/document-store.js";

export function useCalendar() {
  const today = new Date();
  const visibleMonth = ref(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const editingEventId = ref(null);
  const isAiScheduleOpen = ref(false);
  const isEventDialogOpen = ref(false);
  const pendingDate = ref("");
  const eventsVersion = ref(0);
  const returnFocus = ref(null);
  const slideDirection = ref("next");
  const isBatchDialogOpen = ref(false);
  const pendingBatchEvents = ref([]);
  const aiPrefill = ref(null);
  const isImporting = ref(false);
  const importError = ref("");
  const importBannerOpen = ref(false);
  const importCount = ref(0);
  const importDocName = ref("");

  const calendars = ref(getCalendars());
  const visibleCalendarIds = ref(
    new Set(calendars.value.map((calendar) => calendar.id)),
  );

  function toggleCalendar(id, checked) {
    const next = new Set(visibleCalendarIds.value);

    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }

    visibleCalendarIds.value = next;
  }

  function addCalendar(label) {
    const calendar = createCalendar(label);
    calendars.value = getCalendars();

    if (!visibleCalendarIds.value.has(calendar.id)) {
      visibleCalendarIds.value = new Set([
        ...visibleCalendarIds.value,
        calendar.id,
      ]);
    }
  }

  function removeCalendar(id) {
    if (calendars.value.length <= 1) {
      return false;
    }

    const hasEvents = getEvents().some(
      (event) => event.calendarId === id,
    );

    if (hasEvents) {
      const fallback =
        calendars.value.find((calendar) => calendar.id === "other") ??
        calendars.value.find((calendar) => calendar.id !== id);
      reassignEventsCalendar(id, fallback.id);
    }

    deleteCalendar(id);
    calendars.value = getCalendars();

    if (visibleCalendarIds.value.has(id)) {
      const next = new Set(visibleCalendarIds.value);
      next.delete(id);
      visibleCalendarIds.value = next;
    }

    eventsVersion.value++;
    return true;
  }

  function updateCalendarTag(id, label, color) {
    updateCalendar(id, label, color);
    calendars.value = getCalendars();
  }

  function reorderCalendars(fromId, toId) {
    const fromIndex = calendars.value.findIndex(
      (calendar) => calendar.id === fromId,
    );
    const toIndex = calendars.value.findIndex(
      (calendar) => calendar.id === toId,
    );

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return;
    }

    const next = [...calendars.value];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    calendars.value = next;
    saveCalendars(next);
  }

  const monthTitle = computed(() =>
    formatMonthTitle(
      visibleMonth.value.getFullYear(),
      visibleMonth.value.getMonth(),
    ),
  );

  const view = computed(() => {
    eventsVersion.value;
    return buildCalendarView(
      visibleMonth.value.getFullYear(),
      visibleMonth.value.getMonth(),
      getEvents(),
      new Date(),
      visibleCalendarIds.value,
    );
  });

  const days = computed(() => view.value.days);
  const bars = computed(() => view.value.bars);

  function changeMonth(offset) {
    slideDirection.value = offset > 0 ? "next" : "prev";
    visibleMonth.value = new Date(
      visibleMonth.value.getFullYear(),
      visibleMonth.value.getMonth() + offset,
      1,
    );
  }

  function goToday() {
    const todayDate = new Date();
    const targetMonth = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth(),
      1,
    );

    if (targetMonth.getTime() === visibleMonth.value.getTime()) {
      return;
    }

    slideDirection.value =
      targetMonth > visibleMonth.value ? "next" : "prev";
    visibleMonth.value = targetMonth;
  }

  function goToDate(year, monthIndex) {
    const target = new Date(year, monthIndex, 1);
    slideDirection.value = target > visibleMonth.value ? "next" : "prev";
    visibleMonth.value = target;
  }

  function refreshEvents() {
    eventsVersion.value++;
  }

  function toggleAiSchedule() {
    isAiScheduleOpen.value = !isAiScheduleOpen.value;
  }

  function openCreateEventDialog(dateKey) {
    editingEventId.value = null;
    aiPrefill.value = null;
    pendingDate.value = dateKey;
    returnFocus.value = {
      type: "date",
      value: dateKey,
      fallbackDate: dateKey,
    };
    isEventDialogOpen.value = true;
  }

  function openEditEventDialog(eventId) {
    const event = getEvents().find(
      (storedEvent) => storedEvent.id === eventId,
    );

    if (!event) {
      return;
    }

    editingEventId.value = event.id;
    aiPrefill.value = null;
    returnFocus.value = {
      type: "event",
      value: event.id,
      fallbackDate: event.date,
    };
    isEventDialogOpen.value = true;
  }

  function navigateToEvent(event) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.date);

    if (!match) {
      return;
    }

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const target = new Date(year, monthIndex, 1);
    slideDirection.value = target > visibleMonth.value ? "next" : "prev";
    visibleMonth.value = target;
    openEditEventDialog(event.id);
  }

  function openCreateEventFromAi(event) {
    editingEventId.value = null;
    aiPrefill.value = event;
    pendingDate.value = event.date;
    returnFocus.value = {
      type: "date",
      value: event.date,
      fallbackDate: event.date,
    };
    isEventDialogOpen.value = true;
  }

  // 面板確認入曆後遞交：單一事件開編輯框預填，多事件進批量確認（見 docs/adr/0007）。
  function handleAiConfirmEvent(event) {
    isAiScheduleOpen.value = false;
    openCreateEventFromAi(event);
  }

  function handleAiConfirmBatch(events) {
    isAiScheduleOpen.value = false;
    pendingBatchEvents.value = events;
    isBatchDialogOpen.value = true;
  }

  function handleBatchConfirm() {
    for (const event of pendingBatchEvents.value) {
      try {
        createEvent(event);
      } catch {}
    }

    isBatchDialogOpen.value = false;
    pendingBatchEvents.value = [];
    eventsVersion.value++;
  }

  function handleBatchClose() {
    isBatchDialogOpen.value = false;
    pendingBatchEvents.value = [];
  }

  function handleEventSaved() {
    eventsVersion.value++;
    isEventDialogOpen.value = false;
  }

  async function handleEventDeleted(event) {
    if (returnFocus.value) {
      returnFocus.value = {
        ...returnFocus.value,
        type: "date",
        value: event?.date ?? "",
      };
    }

    // 刪除文檔的最後一個事件時，連同文檔紀錄一併移除（避免管理中心出現「0 筆」孤兒）。
    if (typeof event?.sourceDocId === "string" && event.sourceDocId) {
      const hasMore = getEvents().some(
        (item) => item.sourceDocId === event.sourceDocId,
      );

      if (!hasMore) {
        await removeDocument(event.sourceDocId);
      }
    }

    eventsVersion.value++;
    isEventDialogOpen.value = false;
  }

  // 刪除事件；若它是所屬文檔的最後一個事件，連同文檔紀錄一併移除。
  async function deleteEventWithCleanup(eventId) {
    const event = getEvents().find((item) => item.id === eventId);

    if (!event) {
      return false;
    }

    deleteEvent(eventId);

    if (typeof event.sourceDocId === "string" && event.sourceDocId) {
      const hasMore = getEvents().some(
        (item) => item.sourceDocId === event.sourceDocId,
      );

      if (!hasMore) {
        await removeDocument(event.sourceDocId);
      }
    }

    eventsVersion.value++;
    return true;
  }

  function handleDialogClosed() {
    isEventDialogOpen.value = false;
    aiPrefill.value = null;
    restoreFocus();
  }

  async function importDocument(file) {
    isImporting.value = true;
    importError.value = "";
    importBannerOpen.value = false;

    try {
      const { events, extractedText } = await analyzeDocument(
        file,
        calendars.value,
      );

      await importAnalyzedResult({
        events,
        extractedText,
        name: file.name,
        mimeType: file.type,
        blob: file,
      });
    } catch (error) {
      importError.value =
        error instanceof Error ? error.message : "文檔匯入失敗。";
      importBannerOpen.value = true;
    } finally {
      isImporting.value = false;
    }
  }

  // 匯入已抽取的事件結果：先以用戶分類歸一（未知分類回落 personal），再逐筆入曆，
  // 建立文檔紀錄並存原檔／統一文本。拖曳上傳（blob=原檔）與右鍵收件箱（無 blob）
  // 共用此路徑（見 docs/adr/0008）。
  async function importAnalyzedResult({
    events,
    extractedText,
    name,
    mimeType,
    blob,
  }) {
    const calendarIds = new Set(calendars.value.map((calendar) => calendar.id));
    const fallbackCalendarId = calendars.value[0]?.id ?? "personal";
    // 抽取結果的 calendarId 可能不在用戶分類清單（右鍵匯入不帶分類，模型常回傳 personal），
    // 入庫前對映到用戶第一個分類，避免 createEvent 因無效分類把整批事件丟棄（見 docs/adr/0008）。
    const normalized = normalizeParsedEvents(events, calendarIds).map((event) =>
      calendarIds.has(event.calendarId)
        ? event
        : { ...event, calendarId: fallbackCalendarId },
    );

    if (normalized.length === 0) {
      importError.value = "未能從文檔中解析出任何事件，請檢查文檔內容。";
      importBannerOpen.value = true;
      return false;
    }

    const docId = crypto.randomUUID();
    let importedCount = 0;
    const seenKeys = new Set();

    for (const event of normalized) {
      // 同一匯入批次內 title＋日期＋結束日完全相同的重複事件只保留一條
      //（視覺／文本模型偶爾對同一事件回傳多筆，見 docs/adr/0008）。
      const key = `${event.title}|${event.date}|${event.endDate}`;

      if (seenKeys.has(key)) {
        continue;
      }

      seenKeys.add(key);

      try {
        createEvent({
          ...event,
          sourceDocId: docId,
          sourceQuote: event.quote,
        });
        importedCount += 1;
      } catch {
        // 單筆無效事件不阻斷整批匯入
      }
    }

    if (importedCount === 0) {
      importError.value = "未能從文檔中解析出任何事件，請檢查文檔內容。";
      importBannerOpen.value = true;
      return false;
    }

    createDocument({
      id: docId,
      name: typeof name === "string" ? name : "",
      mimeType: typeof mimeType === "string" ? mimeType : "",
      size: blob?.size ?? 0,
      hasText: typeof extractedText === "string" && extractedText !== "",
    });

    if (blob) {
      try {
        await saveDocumentBlob(docId, blob);
      } catch {
        // 原檔存儲失敗不阻斷事件匯入（檢視原檔為後續功能）
      }
    }

    if (extractedText) {
      try {
        await saveDocumentText(docId, extractedText);
      } catch {
        // 統一文本存儲失敗不阻斷事件匯入（檢視原文為後續功能）
      }
    }

    importCount.value = importedCount;
    importDocName.value = typeof name === "string" ? name : "";
    importBannerOpen.value = true;
    eventsVersion.value++;
    return true;
  }

  // 刪除單一文檔及其全部關聯事件、原檔 blob 與統一文本；供管理中心「刪除文件」使用。
  async function removeDocument(docId) {
    if (typeof docId !== "string" || !docId) {
      return false;
    }

    const hasDocument = getDocument(docId) !== null;
    const hasEvents = getEvents().some(
      (event) => event.sourceDocId === docId,
    );

    if (!hasDocument && !hasEvents) {
      return false;
    }

    const docEvents = getEvents().filter(
      (event) => event.sourceDocId === docId,
    );

    for (const event of docEvents) {
      deleteEvent(event.id);
    }

    deleteDocument(docId);
    await deleteDocumentBlob(docId);
    await deleteDocumentText(docId);

    return true;
  }

  function closeImportBanner() {
    importBannerOpen.value = false;
    importError.value = "";
  }

  function restoreFocus() {
    const current = returnFocus.value;
    returnFocus.value = null;

    if (!current) {
      return;
    }

    nextTick(() => {
      const selector =
        current.type === "event" ? "[data-event-id]" : "button[data-date]";
      const dataKey = current.type === "event" ? "eventId" : "date";
      const matchingElement = [...document.querySelectorAll(selector)].find(
        (element) => element.dataset[dataKey] === current.value,
      );

      if (matchingElement) {
        matchingElement.focus();
        return;
      }

      [...document.querySelectorAll("button[data-date]")].find(
        (element) => element.dataset.date === current.fallbackDate,
      )?.focus();
    });
  }

  return {
    visibleMonth,
    editingEventId,
    isAiScheduleOpen,
    isEventDialogOpen,
    pendingDate,
    aiPrefill,
    isBatchDialogOpen,
    pendingBatchEvents,
    calendars,
    visibleCalendarIds,
    slideDirection,
    monthTitle,
    days,
    bars,
    changeMonth,
    goToday,
    goToDate,
    refreshEvents,
    toggleCalendar,
    addCalendar,
    removeCalendar,
    updateCalendarTag,
    reorderCalendars,
    toggleAiSchedule,
    handleAiConfirmEvent,
    handleAiConfirmBatch,
    handleBatchConfirm,
    handleBatchClose,
    openCreateEventDialog,
    openEditEventDialog,
    navigateToEvent,
    handleEventSaved,
    handleEventDeleted,
    deleteEventWithCleanup,
    handleDialogClosed,
    isImporting,
    importError,
    importBannerOpen,
    importCount,
    importDocName,
    importDocument,
    importAnalyzedResult,
    removeDocument,
    closeImportBanner,
  };
}
