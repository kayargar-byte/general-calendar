import assert from "node:assert/strict";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, test, vi } from "vitest";
import AiSchedulePanel from "../src/components/AiSchedulePanel.vue";
import { getSearchHistory } from "../src/lib/user-profile.js";

// 面板依賴 askAi 的判別式回應；用 mock 驅動澄清／候選／直接入曆三分支。
vi.mock("../src/lib/ai.js", () => ({
  askAi: vi.fn(),
}));

import { askAi } from "../src/lib/ai.js";

const CALENDARS = [{ id: "personal", label: "個人" }];

afterEach(() => {
  localStorage.clear();
});

function mountPanel() {
  return mount(AiSchedulePanel, {
    props: {
      open: true,
      calendars: CALENDARS,
    },
  });
}

function eventsResult(events, candidates = [], recommendations = []) {
  return {
    type: "events",
    events,
    candidates,
    recommendations,
    explanation: "",
  };
}

beforeEach(() => {
  askAi.mockReset();
});

test("AiSchedulePanel shows clarify options and continues with context on selection", async () => {
  askAi.mockResolvedValueOnce({
    type: "clarify",
    question: "你想查什麼？",
    options: [
      { id: "a", label: "颱風假" },
      { id: "b", label: "航班" },
    ],
  });
  askAi.mockResolvedValueOnce(
    eventsResult([{ title: "颱風假", date: "2026-08-07", calendarId: "personal" }]),
  );
  const wrapper = mountPanel();

  await wrapper.find("#ai-schedule-input").setValue("颱風");
  await wrapper.find("#analyze-ai-schedule").trigger("click");
  await flushPromises();

  assert.equal(wrapper.find(".ai-clarify-question").text(), "你想查什麼？");
  assert.equal(wrapper.findAll(".ai-clarify-option").length, 2);

  await wrapper.findAll(".ai-clarify-option")[0].trigger("click");
  await flushPromises();

  // 續輪：text 為選擇註記，contextMessages 含上一回合 assistant 澄清。
  const [text, , options] = askAi.mock.calls[1];
  assert.equal(text, "已選選項：颱風假");
  assert.equal(options.contextMessages.length, 1);
  assert.equal(options.contextMessages[0].role, "assistant");
  assert.equal(wrapper.emitted("confirm-event")?.[0]?.[0].title, "颱風假");
});

test("AiSchedulePanel shows candidates with source and confirms the selected one", async () => {
  askAi.mockResolvedValueOnce(
    eventsResult([], [
      {
        title: "美食節",
        date: "2026-03-20",
        calendarId: "other",
        sourceUrl: "https://m.gov.mo/a",
        sourceTitle: "官方",
        sourceSnippet: "3月20日",
      },
    ]),
  );
  const wrapper = mountPanel();

  await wrapper.find("#ai-schedule-input").setValue("美食節");
  await wrapper.find("#analyze-ai-schedule").trigger("click");
  await flushPromises();

  assert.equal(wrapper.find(".ai-candidate-title").text(), "美食節");
  assert.equal(wrapper.find(".ai-candidate-source-name").text(), "官方");

  await wrapper.find(".ai-candidate-confirm").trigger("click");

  assert.equal(
    wrapper.emitted("confirm-event")?.[0]?.[0].sourceUrl,
    "https://m.gov.mo/a",
  );
});

test("AiSchedulePanel shows the candidate's calendar category with its label", async () => {
  askAi.mockResolvedValueOnce(
    eventsResult([], [
      {
        title: "覆診",
        date: "2026-08-06",
        calendarId: "medical",
        sourceUrl: "https://example.com/med",
        sourceTitle: "衛生局",
        sourceSnippet: "",
      },
    ]),
  );
  const wrapper = mount(AiSchedulePanel, {
    props: {
      open: true,
      calendars: [
        { id: "personal", label: "個人" },
        { id: "medical", label: "醫療", color: "#7857b3" },
      ],
    },
  });

  await wrapper.find("#ai-schedule-input").setValue("覆診");
  await wrapper.find("#analyze-ai-schedule").trigger("click");
  await flushPromises();

  assert.equal(wrapper.find(".ai-candidate-calendar").text(), "醫療");
});

test("AiSchedulePanel emits confirm-event for a single event", async () => {
  askAi.mockResolvedValueOnce(
    eventsResult([{ title: "看醫生", date: "2026-08-06", calendarId: "medical" }]),
  );
  const wrapper = mountPanel();

  await wrapper.find("#ai-schedule-input").setValue("後天看醫生");
  await wrapper.find("#analyze-ai-schedule").trigger("click");
  await flushPromises();

  assert.equal(wrapper.emitted("confirm-event")?.[0]?.[0].title, "看醫生");
});

test("AiSchedulePanel emits confirm-events for multiple events", async () => {
  askAi.mockResolvedValueOnce(
    eventsResult([
      { title: "A", date: "2026-08-07", calendarId: "personal" },
      { title: "B", date: "2026-08-08", calendarId: "personal" },
    ]),
  );
  const wrapper = mountPanel();

  await wrapper.find("#ai-schedule-input").setValue("兩天都有事");
  await wrapper.find("#analyze-ai-schedule").trigger("click");
  await flushPromises();

  assert.equal(wrapper.emitted("confirm-events")?.[0]?.[0].length, 2);
});

test("AiSchedulePanel shows the empty message when nothing is schedulable", async () => {
  askAi.mockResolvedValueOnce({
    ...eventsResult([]),
    explanation: "查無日期資訊",
  });
  const wrapper = mountPanel();

  await wrapper.find("#ai-schedule-input").setValue("天氣");
  await wrapper.find("#analyze-ai-schedule").trigger("click");
  await flushPromises();

  assert.equal(wrapper.find("#ai-schedule-empty").text(), "查無日期資訊");
});

test("AiSchedulePanel surfaces analyze errors", async () => {
  askAi.mockRejectedValueOnce(new Error("AI 服務回應錯誤。"));
  const wrapper = mountPanel();

  await wrapper.find("#ai-schedule-input").setValue("颱風");
  await wrapper.find("#analyze-ai-schedule").trigger("click");
  await flushPromises();

  assert.match(wrapper.find("#ai-schedule-error").text(), /AI 服務回應錯誤/);
});

test("AiSchedulePanel records the query and marks it adopted on direct confirmation", async () => {
  askAi.mockResolvedValueOnce(
    eventsResult([
      { title: "看醫生", date: "2026-08-06", calendarId: "medical" },
    ]),
  );
  const wrapper = mountPanel();

  await wrapper.find("#ai-schedule-input").setValue("後天看醫生");
  await wrapper.find("#analyze-ai-schedule").trigger("click");
  await flushPromises();

  assert.equal(wrapper.emitted("confirm-event")?.[0]?.[0].title, "看醫生");

  const history = getSearchHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].query, "後天看醫生");
  assert.equal(history[0].adopted, true);
});

test("AiSchedulePanel marks the query adopted when a candidate is confirmed", async () => {
  askAi.mockResolvedValueOnce(
    eventsResult([], [
      {
        title: "美食節",
        date: "2026-03-20",
        calendarId: "other",
        sourceUrl: "https://m.gov.mo/a",
        sourceTitle: "官方",
        sourceSnippet: "",
      },
    ]),
  );
  const wrapper = mountPanel();

  await wrapper.find("#ai-schedule-input").setValue("美食節");
  await wrapper.find("#analyze-ai-schedule").trigger("click");
  await flushPromises();
  await wrapper.find(".ai-candidate-confirm").trigger("click");

  const history = getSearchHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].query, "美食節");
  assert.equal(history[0].adopted, true);
});

test("AiSchedulePanel records the query without adoption on an empty result", async () => {
  askAi.mockResolvedValueOnce({
    ...eventsResult([]),
    explanation: "查無日期資訊",
  });
  const wrapper = mountPanel();

  await wrapper.find("#ai-schedule-input").setValue("天氣");
  await wrapper.find("#analyze-ai-schedule").trigger("click");
  await flushPromises();

  const history = getSearchHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].query, "天氣");
  assert.equal(history[0].adopted, false);
});

test("AiSchedulePanel shows recommendation chips and re-searches on click", async () => {
  askAi.mockResolvedValueOnce(
    eventsResult([], [], [
      { topic: "政府津貼", reason: "你常搜補助" },
      { topic: "疫苗接種時間", reason: "" },
    ]),
  );
  askAi.mockResolvedValueOnce(
    eventsResult([
      { title: "政府津貼", date: "2026-08-20", calendarId: "personal" },
    ]),
  );
  const wrapper = mountPanel();

  await wrapper.find("#ai-schedule-input").setValue("補助");
  await wrapper.find("#analyze-ai-schedule").trigger("click");
  await flushPromises();

  assert.equal(wrapper.findAll(".ai-recommendation-chip").length, 2);
  assert.equal(wrapper.find(".ai-recommendation-chip").text(), "政府津貼");

  await wrapper.find(".ai-recommendation-chip").trigger("click");
  await flushPromises();

  // 第二次呼叫的查詢即為被點擊的推薦主題。
  assert.equal(askAi.mock.calls[1][0], "政府津貼");
  assert.equal(wrapper.emitted("confirm-event")?.[0]?.[0].title, "政府津貼");
});
