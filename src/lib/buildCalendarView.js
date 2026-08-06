import {
  buildMonthGrid,
  formatDateLabel,
  toDateKey,
} from "./date-utils.js";

// 回傳 { days, bars }：
// - days：可見月網格的每日物件（含跨月邊界的 placeholder 格）；
//   多日事件（endDate 非空）注入覆蓋的每個日期。
// - bars：多日事件的長條幾何，每條 { event, startIndex, endIndex }，索引指向 days；
//   以週行（7 格）為界拆段、只涵蓋當月格，供跨日長條渲染使用。
export function buildCalendarView(
  year,
  monthIndex,
  events,
  today = new Date(),
  visibleCalendarIds,
) {
  const todayKey = toDateKey(today);
  const days = buildMonthGrid(year, monthIndex).map((date) => {
    const dateKey = toDateKey(date);

    return {
      dateKey,
      dayNumber: date.getDate(),
      label: formatDateLabel(date),
      isCurrentMonth: date.getMonth() === monthIndex,
      isToday: dateKey === todayKey,
      events: [],
    };
  });

  const daysByKey = new Map(days.map((day) => [day.dateKey, day]));
  const bars = [];

  for (const event of events) {
    if (visibleCalendarIds && !visibleCalendarIds.has(event.calendarId)) {
      continue;
    }

    if (!event.endDate) {
      daysByKey.get(event.date)?.events.push(event);
      continue;
    }

    // 多日事件：注入覆蓋的每個日期（含跨月邊界的 placeholder 格）。
    for (const day of days) {
      if (day.dateKey >= event.date && day.dateKey <= event.endDate) {
        day.events.push(event);
      }
    }

    // 長條幾何：當月格且落在 [date, endDate] 內才產生；索引連續且未跨週行末尾（index % 7 === 6）時併入前一長條。
    let segment = null;

    for (let index = 0; index < days.length; index++) {
      const day = days[index];
      const covered =
        day.isCurrentMonth &&
        day.dateKey >= event.date &&
        day.dateKey <= event.endDate;

      if (!covered) {
        segment = null;
        continue;
      }

      if (
        segment &&
        index === segment.endIndex + 1 &&
        segment.endIndex % 7 !== 6
      ) {
        segment.endIndex = index;
      } else {
        segment = { event, startIndex: index, endIndex: index };
        bars.push(segment);
      }
    }
  }

  // 同一週行內日期範圍相交的長條分到不同車道（lane），避免視覺重疊（見 CalendarGrid barStyle）。
  const barsByRow = new Map();

  for (const bar of bars) {
    const row = Math.floor(bar.startIndex / 7);
    const rowBars = barsByRow.get(row) ?? [];
    rowBars.push(bar);
    barsByRow.set(row, rowBars);
  }

  for (const rowBars of barsByRow.values()) {
    rowBars.sort((a, b) => a.startIndex - b.startIndex);
    const laneOccupiedEnd = [];

    for (const bar of rowBars) {
      const lane = laneOccupiedEnd.findIndex((end) => end < bar.startIndex);

      if (lane === -1) {
        laneOccupiedEnd.push(bar.endIndex);
        bar.lane = laneOccupiedEnd.length - 1;
      } else {
        laneOccupiedEnd[lane] = bar.endIndex;
        bar.lane = lane;
      }
    }
  }

  // 每格被幾條跨日長條覆蓋：供覆蓋格的單日事件下推避開整疊長條（見 calendar.css）。
  for (const day of days) {
    day.coveredBars = 0;
  }

  for (const bar of bars) {
    for (let index = bar.startIndex; index <= bar.endIndex; index++) {
      days[index].coveredBars += 1;
    }
  }

  return { days, bars };
}
