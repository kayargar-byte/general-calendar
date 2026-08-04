export const LANG_STORAGE_KEY = "general-calendar.language";

export const LANGUAGES = [
  { code: "zh-TW", label: "繁體中文" },
  { code: "zh-CN", label: "简体中文" },
  { code: "en", label: "English" },
];

const DEFAULT_LANGUAGE = "zh-TW";

let currentLanguage = DEFAULT_LANGUAGE;

const translations = {
  "zh-TW": {
    "app.title": "我的日曆",
    "app.newEvent": "新增事件",
    "app.today": "今天",
    "monthNav.ariaLabel": "月份導覽",
    "monthNav.prev": "上個月",
    "monthNav.next": "下個月",
    "search.placeholder": "搜尋事件",
    "search.ariaLabel": "搜尋事件",
    "search.empty": "找不到符合的事件。",
    "search.allDay": "全天",
    "theme.toggleAria": "切換主題",
    "manage.button": "管理中心",
    "settings.button": "設定",
    "settings.buttonAria": "開啟設定",
    "sidebar.title": "日曆導覽",
    "sidebar.miniTitle": "迷你月曆",
    "sidebar.miniLoading": "迷你月曆準備中",
    "sidebar.myCalendars": "我的日曆",
    "sidebar.addTag": "新增標籤",
    "calendarLabel.personal": "個人",
    "calendarLabel.documents": "證件續期",
    "calendarLabel.medical": "醫療",
    "calendarLabel.family": "家庭",
    "calendarLabel.work": "工作",
    "calendarLabel.other": "其他",
    "tag.edit": "編輯",
    "tag.editAria": "編輯「{name}」標籤",
    "ai.title": "AI 輸入日程",
    "ai.closeAria": "收合 AI 輸入日程",
    "ai.describe": "描述日程",
    "ai.placeholder": "例如：下週三下午三時看醫生",
    "ai.analyze": "分析日程",
    "ai.analyzing": "分析中…",
    "ai.launcher": "輸入日程",
    "calendar.title": "月曆",
    "calendar.loading": "月曆準備中",
    "weekday.mon": "一",
    "weekday.tue": "二",
    "weekday.wed": "三",
    "weekday.thu": "四",
    "weekday.fri": "五",
    "weekday.sat": "六",
    "weekday.sun": "日",
    "eventDialog.new": "新增事件",
    "eventDialog.edit": "編輯事件",
    "eventDialog.close": "關閉",
    "eventDialog.title": "標題",
    "eventDialog.date": "日期",
    "eventDialog.calendar": "日曆",
    "eventDialog.startTime": "開始時間",
    "eventDialog.endTime": "結束時間",
    "eventDialog.notes": "備註",
    "eventDialog.cancel": "取消",
    "eventDialog.save": "儲存",
    "eventDialog.delete": "刪除",
    "tagDialog.new": "新增標籤",
    "tagDialog.edit": "編輯標籤",
    "tagDialog.name": "標籤名稱",
    "tagDialog.color": "標籤顏色",
    "tagDialog.colorAria": "標籤顏色",
    "batchDialog.title": "確認批次新增事件",
    "batchDialog.hint": "以下事件將被新增到日曆：",
    "batchDialog.cancel": "取消",
    "batchDialog.confirm": "全部新增",
    "manage.title": "管理中心",
    "manage.closeAria": "關閉管理中心",
    "manage.events": "事件管理",
    "manage.tags": "標籤管理",
    "manage.edit": "編輯",
    "manage.delete": "刪除",
    "manage.reset": "重置",
    "manage.empty.events": "尚無事件。",
    "manage.empty.tags": "尚無標籤。",
    "manage.eventCount": "{count} 個事件",
    "settings.title": "設定",
    "settings.close": "關閉",
    "settings.language": "語言",
    "settings.theme": "主題",
    "settings.light": "亮色",
    "settings.dark": "暗色",
    "datePicker.year": "年",
    "datePicker.month": "月",
    "datePicker.day": "日",
    "datePicker.confirm": "跳轉",
    "datePicker.cancel": "取消",
    "error.titleRequired": "標題為必填。",
    "error.dateInvalid": "日期格式無效。",
    "error.startTimeInvalid": "開始時間格式無效。",
    "error.endTimeInvalid": "結束時間格式無效。",
    "error.endBeforeStart": "結束時間不得早於開始時間。",
    "error.calendarInvalid": "日曆分類 calendarId 無效。",
    "error.tagNameRequired": "標籤名稱為必填。",
    "error.tagNameTooLong": "標籤名稱不得超過 20 個字。",
    "error.tagColorInvalid": "標籤顏色格式無效。",
    "error.tagNameExists": "此標籤名稱已存在。",
    "error.tagNotFound": "找不到要更新的標籤。",
    "error.deleteBuiltIn": "無法刪除內建標籤，請改用重置功能。",
    "error.resetCustom": "無法重置自訂標籤。",
    "error.deleteTagNotFound": "找不到要刪除的標籤。",
    "error.eventNotFound": "找不到要更新的事件。",
    "error.storageUnsupported": "此環境不支援本機儲存。",
    "error.pageStructure": "月曆頁面結構不完整。",
    "error.saveEvent": "無法儲存事件。",
    "error.saveTag": "無法儲存標籤。",
    "error.deleteTag": "無法刪除標籤。",
    "error.resetTag": "無法重置標籤。",
    "error.analyzeSchedule": "無法分析日程。",
    "error.aiParse": "AI 無法解析此日程，請嘗試更具體的描述。",
    "error.aiNotConfigured": "尚未設定 AI API 金鑰，請複製 js/config.example.js 為 js/config.js 並填入金鑰。",
    "error.aiConnection": "無法連接 AI 服務，請確認已啟動本地代理伺服器（npm start）。",
    "error.aiResponse": "AI 服務回應錯誤（{status}）。",
    "error.inputEmpty": "請先輸入日程描述。",
    "confirm.deleteEvent": "確定要刪除「{title}」嗎？",
    "confirm.deleteTag": "確定要刪除「{name}」標籤嗎？",
    "confirm.resetTag": "確定要將「{name}」標籤重置為預設嗎？",
    "alert.tagHasEvents": "此標籤仍有 {count} 個事件，無法刪除。請先移除或更改事件標籤。",
    "conflict.message": "此事件與以下事件時間衝突：{list}。再次點擊儲存可繼續。",
    "event.untitled": "未命名事件",
    "event.addDateAria": "新增 {label} 的事件",
    "event.viewEventAria": "查看事件：{summary}",
    "mini.calendarLoading": "迷你月曆準備中",
  },
  "zh-CN": {
    "app.title": "我的日历",
    "app.newEvent": "新建事件",
    "app.today": "今天",
    "monthNav.ariaLabel": "月份导航",
    "monthNav.prev": "上个月",
    "monthNav.next": "下个月",
    "search.placeholder": "搜索事件",
    "search.ariaLabel": "搜索事件",
    "search.empty": "找不到匹配的事件。",
    "search.allDay": "全天",
    "theme.toggleAria": "切换主题",
    "manage.button": "管理中心",
    "settings.button": "设置",
    "settings.buttonAria": "打开设置",
    "sidebar.title": "日历导航",
    "sidebar.miniTitle": "迷你月历",
    "sidebar.miniLoading": "迷你月历准备中",
    "sidebar.myCalendars": "我的日历",
    "sidebar.addTag": "添加标签",
    "calendarLabel.personal": "个人",
    "calendarLabel.documents": "证件续期",
    "calendarLabel.medical": "医疗",
    "calendarLabel.family": "家庭",
    "calendarLabel.work": "工作",
    "calendarLabel.other": "其他",
    "tag.edit": "编辑",
    "tag.editAria": "编辑「{name}」标签",
    "ai.title": "AI 输入日程",
    "ai.closeAria": "收起 AI 输入日程",
    "ai.describe": "描述日程",
    "ai.placeholder": "例如：下周三下午三点看医生",
    "ai.analyze": "分析日程",
    "ai.analyzing": "分析中…",
    "ai.launcher": "输入日程",
    "calendar.title": "月历",
    "calendar.loading": "月历准备中",
    "weekday.mon": "一",
    "weekday.tue": "二",
    "weekday.wed": "三",
    "weekday.thu": "四",
    "weekday.fri": "五",
    "weekday.sat": "六",
    "weekday.sun": "日",
    "eventDialog.new": "新建事件",
    "eventDialog.edit": "编辑事件",
    "eventDialog.close": "关闭",
    "eventDialog.title": "标题",
    "eventDialog.date": "日期",
    "eventDialog.calendar": "日历",
    "eventDialog.startTime": "开始时间",
    "eventDialog.endTime": "结束时间",
    "eventDialog.notes": "备注",
    "eventDialog.cancel": "取消",
    "eventDialog.save": "保存",
    "eventDialog.delete": "删除",
    "tagDialog.new": "添加标签",
    "tagDialog.edit": "编辑标签",
    "tagDialog.name": "标签名称",
    "tagDialog.color": "标签颜色",
    "tagDialog.colorAria": "标签颜色",
    "batchDialog.title": "确认批量新建事件",
    "batchDialog.hint": "以下事件将被添加到日历：",
    "batchDialog.cancel": "取消",
    "batchDialog.confirm": "全部添加",
    "manage.title": "管理中心",
    "manage.closeAria": "关闭管理中心",
    "manage.events": "事件管理",
    "manage.tags": "标签管理",
    "manage.edit": "编辑",
    "manage.delete": "删除",
    "manage.reset": "重置",
    "manage.empty.events": "暂无事件。",
    "manage.empty.tags": "暂无标签。",
    "manage.eventCount": "{count} 个事件",
    "settings.title": "设置",
    "settings.close": "关闭",
    "settings.language": "语言",
    "settings.theme": "主题",
    "settings.light": "亮色",
    "settings.dark": "暗色",
    "datePicker.year": "年",
    "datePicker.month": "月",
    "datePicker.day": "日",
    "datePicker.confirm": "跳转",
    "datePicker.cancel": "取消",
    "error.titleRequired": "标题为必填。",
    "error.dateInvalid": "日期格式无效。",
    "error.startTimeInvalid": "开始时间格式无效。",
    "error.endTimeInvalid": "结束时间格式无效。",
    "error.endBeforeStart": "结束时间不得早于开始时间。",
    "error.calendarInvalid": "日历分类 calendarId 无效。",
    "error.tagNameRequired": "标签名称为必填。",
    "error.tagNameTooLong": "标签名称不得超过 20 个字。",
    "error.tagColorInvalid": "标签颜色格式无效。",
    "error.tagNameExists": "此标签名称已存在。",
    "error.tagNotFound": "找不到要更新的标签。",
    "error.deleteBuiltIn": "无法删除内置标签，请改用重置功能。",
    "error.resetCustom": "无法重置自定义标签。",
    "error.deleteTagNotFound": "找不到要删除的标签。",
    "error.eventNotFound": "找不到要更新的事件。",
    "error.storageUnsupported": "此环境不支持本地存储。",
    "error.pageStructure": "月历页面结构不完整。",
    "error.saveEvent": "无法保存事件。",
    "error.saveTag": "无法保存标签。",
    "error.deleteTag": "无法删除标签。",
    "error.resetTag": "无法重置标签。",
    "error.analyzeSchedule": "无法分析日程。",
    "error.aiParse": "AI 无法解析此日程，请尝试更具体的描述。",
    "error.aiNotConfigured": "尚未设置 AI API 密钥，请复制 js/config.example.js 为 js/config.js 并填入密钥。",
    "error.aiConnection": "无法连接 AI 服务，请确认已启动本地代理服务器（npm start）。",
    "error.aiResponse": "AI 服务回应错误（{status}）。",
    "error.inputEmpty": "请先输入日程描述。",
    "confirm.deleteEvent": "确定要删除「{title}」吗？",
    "confirm.deleteTag": "确定要删除「{name}」标签吗？",
    "confirm.resetTag": "确定要将「{name}」标签重置为预设吗？",
    "alert.tagHasEvents": "此标签仍有 {count} 个事件，无法删除。请先移除或更改事件标签。",
    "conflict.message": "此事件与以下事件时间冲突：{list}。再次点击保存可继续。",
    "event.untitled": "未命名事件",
    "event.addDateAria": "新建 {label} 的事件",
    "event.viewEventAria": "查看事件：{summary}",
    "mini.calendarLoading": "迷你月历准备中",
  },
  en: {
    "app.title": "My Calendar",
    "app.newEvent": "New Event",
    "app.today": "Today",
    "monthNav.ariaLabel": "Month navigation",
    "monthNav.prev": "Previous month",
    "monthNav.next": "Next month",
    "search.placeholder": "Search events",
    "search.ariaLabel": "Search events",
    "search.empty": "No matching events found.",
    "search.allDay": "All day",
    "theme.toggleAria": "Toggle theme",
    "manage.button": "Manage",
    "settings.button": "Settings",
    "settings.buttonAria": "Open settings",
    "sidebar.title": "Calendar navigation",
    "sidebar.miniTitle": "Mini Calendar",
    "sidebar.miniLoading": "Loading mini calendar...",
    "sidebar.myCalendars": "My Calendars",
    "sidebar.addTag": "Add Tag",
    "calendarLabel.personal": "Personal",
    "calendarLabel.documents": "Documents",
    "calendarLabel.medical": "Medical",
    "calendarLabel.family": "Family",
    "calendarLabel.work": "Work",
    "calendarLabel.other": "Other",
    "tag.edit": "Edit",
    "tag.editAria": "Edit \"{name}\" tag",
    "ai.title": "AI Schedule Input",
    "ai.closeAria": "Close AI schedule input",
    "ai.describe": "Describe schedule",
    "ai.placeholder": "e.g., Doctor appointment next Wednesday at 3pm",
    "ai.analyze": "Analyze",
    "ai.analyzing": "Analyzing...",
    "ai.launcher": "Schedule",
    "calendar.title": "Calendar",
    "calendar.loading": "Loading calendar...",
    "weekday.mon": "Mon",
    "weekday.tue": "Tue",
    "weekday.wed": "Wed",
    "weekday.thu": "Thu",
    "weekday.fri": "Fri",
    "weekday.sat": "Sat",
    "weekday.sun": "Sun",
    "eventDialog.new": "New Event",
    "eventDialog.edit": "Edit Event",
    "eventDialog.close": "Close",
    "eventDialog.title": "Title",
    "eventDialog.date": "Date",
    "eventDialog.calendar": "Calendar",
    "eventDialog.startTime": "Start Time",
    "eventDialog.endTime": "End Time",
    "eventDialog.notes": "Notes",
    "eventDialog.cancel": "Cancel",
    "eventDialog.save": "Save",
    "eventDialog.delete": "Delete",
    "tagDialog.new": "New Tag",
    "tagDialog.edit": "Edit Tag",
    "tagDialog.name": "Tag Name",
    "tagDialog.color": "Tag Color",
    "tagDialog.colorAria": "Tag color",
    "batchDialog.title": "Confirm Batch Events",
    "batchDialog.hint": "The following events will be added to the calendar:",
    "batchDialog.cancel": "Cancel",
    "batchDialog.confirm": "Add All",
    "manage.title": "Management Center",
    "manage.closeAria": "Close management center",
    "manage.events": "Events",
    "manage.tags": "Tags",
    "manage.edit": "Edit",
    "manage.delete": "Delete",
    "manage.reset": "Reset",
    "manage.empty.events": "No events yet.",
    "manage.empty.tags": "No tags yet.",
    "manage.eventCount": "{count} event(s)",
    "settings.title": "Settings",
    "settings.close": "Close",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.light": "Light",
    "settings.dark": "Dark",
    "datePicker.year": "Year",
    "datePicker.month": "Month",
    "datePicker.day": "Day",
    "datePicker.confirm": "Go",
    "datePicker.cancel": "Cancel",
    "error.titleRequired": "Title is required.",
    "error.dateInvalid": "Invalid date format.",
    "error.startTimeInvalid": "Invalid start time format.",
    "error.endTimeInvalid": "Invalid end time format.",
    "error.endBeforeStart": "End time cannot be earlier than start time.",
    "error.calendarInvalid": "Invalid calendar ID.",
    "error.tagNameRequired": "Tag name is required.",
    "error.tagNameTooLong": "Tag name cannot exceed 20 characters.",
    "error.tagColorInvalid": "Invalid tag color format.",
    "error.tagNameExists": "This tag name already exists.",
    "error.tagNotFound": "Tag not found.",
    "error.deleteBuiltIn": "Cannot delete built-in tag, use reset instead.",
    "error.resetCustom": "Cannot reset custom tag.",
    "error.deleteTagNotFound": "Tag to delete not found.",
    "error.eventNotFound": "Event not found.",
    "error.storageUnsupported": "Local storage is not supported.",
    "error.pageStructure": "Calendar page structure is incomplete.",
    "error.saveEvent": "Unable to save event.",
    "error.saveTag": "Unable to save tag.",
    "error.deleteTag": "Unable to delete tag.",
    "error.resetTag": "Unable to reset tag.",
    "error.analyzeSchedule": "Unable to analyze schedule.",
    "error.aiParse": "AI could not parse this schedule, please try a more specific description.",
    "error.aiNotConfigured": "AI API key not configured. Copy js/config.example.js to js/config.js and fill in your key.",
    "error.aiConnection": "Cannot connect to AI service, make sure the local proxy server is running (npm start).",
    "error.aiResponse": "AI service error ({status}).",
    "error.inputEmpty": "Please enter a schedule description first.",
    "confirm.deleteEvent": "Are you sure you want to delete \"{title}\"?",
    "confirm.deleteTag": "Are you sure you want to delete tag \"{name}\"?",
    "confirm.resetTag": "Reset tag \"{name}\" to default?",
    "alert.tagHasEvents": "This tag still has {count} event(s), cannot delete. Please remove or reassign events first.",
    "conflict.message": "This event conflicts with: {list}. Click save again to continue.",
    "event.untitled": "Untitled Event",
    "event.addDateAria": "Add event on {label}",
    "event.viewEventAria": "View event: {summary}",
    "mini.calendarLoading": "Loading mini calendar...",
  },
};

export const MONTH_LABELS = {
  "zh-TW": [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ],
  "zh-CN": [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ],
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
};

export const WEEKDAY_LABELS_FULL = {
  "zh-TW": ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
  "zh-CN": ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

export function getCurrentLanguage() {
  return currentLanguage;
}

export function isSupportedLanguage(lang) {
  return Boolean(translations[lang]);
}

export function t(key, params = {}) {
  const dict = translations[currentLanguage] ?? translations[DEFAULT_LANGUAGE];
  let value = dict[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;

  for (const [param, replacement] of Object.entries(params)) {
    value = value.replace(new RegExp(`\\{${param}\\}`, "g"), String(replacement));
  }

  return value;
}

export function loadLanguage() {
  try {
    const stored = globalThis.localStorage?.getItem(LANG_STORAGE_KEY);

    if (stored && translations[stored]) {
      currentLanguage = stored;
    }
  } catch {
    // ignore storage errors
  }

  return currentLanguage;
}

export function setLanguage(lang) {
  if (!translations[lang]) {
    return false;
  }

  currentLanguage = lang;

  try {
    globalThis.localStorage?.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignore storage errors
  }

  return true;
}

export function applyTranslations() {
  if (typeof document === "undefined" || !document.documentElement) {
    return;
  }

  const htmlLang =
    currentLanguage === "zh-CN"
      ? "zh-Hans"
      : currentLanguage === "en"
        ? "en"
        : "zh-Hant";

  document.documentElement.lang = htmlLang;

  const elements = document.querySelectorAll("[data-i18n]");

  for (const el of elements) {
    el.textContent = t(el.dataset.i18n);
  }

  const placeholderElements = document.querySelectorAll("[data-i18n-placeholder]");

  for (const el of placeholderElements) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }

  const ariaElements = document.querySelectorAll("[data-i18n-aria-label]");

  for (const el of ariaElements) {
    el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
  }
}

export function getBuiltInCalendarLabel(id) {
  const key = `calendarLabel.${id}`;
  const dict = translations[currentLanguage] ?? translations[DEFAULT_LANGUAGE];

  return dict[key] ?? translations[DEFAULT_LANGUAGE][key] ?? id;
}
