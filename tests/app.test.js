import assert from "node:assert/strict";
import test from "node:test";

class Element {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.attributes = {};
    this.children = [];
    this.className = "";
    this.dataset = {};
    this.hidden = false;
    this.isConnected = true;
    this.listeners = {};
    this.open = false;
    this.value = "";
    this.classList = {
      add: (...tokens) => {
        const classes = new Set(this.className.split(" ").filter(Boolean));
        tokens.forEach((token) => classes.add(token));
        this.className = [...classes].join(" ");
      },
      contains: (token) => this.className.split(" ").includes(token),
      toggle: (token, force) => {
        const classes = new Set(this.className.split(" ").filter(Boolean));
        const shouldAdd = force ?? !classes.has(token);

        if (shouldAdd) {
          classes.add(token);
        } else {
          classes.delete(token);
        }

        this.className = [...classes].join(" ");
        return shouldAdd;
      },
    };
  }

  addEventListener(type, listener) {
    this.listeners[type] ??= [];
    this.listeners[type].push(listener);
  }

  append(...children) {
    this.children.push(...children);
  }

  click() {
    this.dispatch("click");
  }

  close() {
    this.open = false;
    this.dispatch("close");
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners[type] ?? []) {
      listener({ type, target: this, ...event });
    }
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  querySelector(selector) {
    return this.queries?.[selector] ?? null;
  }

  replaceChildren(...children) {
    this.children = children.flatMap((child) =>
      child.tagName === "#fragment" ? child.children : child,
    );
  }

  reset() {}

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  showModal() {
    this.open = true;
  }
}

function createAppFixture() {
  const selectors = new Map();
  const documentListeners = {};
  const document = {
    activeElement: null,
    addEventListener(type, listener) {
      documentListeners[type] ??= [];
      documentListeners[type].push(listener);
    },
    createDocumentFragment() {
      const fragment = new Element(document);
      fragment.tagName = "#fragment";
      return fragment;
    },
    createElement(tagName) {
      const element = new Element(document);
      element.tagName = tagName;
      return element;
    },
    dispatch(type, event) {
      for (const listener of documentListeners[type] ?? []) {
        listener({ type, ...event });
      }
    },
    querySelector(selector) {
      return selectors.get(selector) ?? null;
    },
    querySelectorAll(selector) {
      if (selector === "#calendar-filters input[type='checkbox']") {
        return calendarFilters;
      }

      return [];
    },
  };
  const createElement = (selector) => {
    const element = new Element(document);
    selectors.set(selector, element);
    return element;
  };
  const calendarFilters = [
    "personal",
    "documents",
    "medical",
    "family",
    "work",
    "other",
  ].map((value) => {
    const filter = new Element(document);
    filter.checked = true;
    filter.value = value;
    return filter;
  });
  const requiredSelectors = [
    "#calendar-title",
    "#calendar-grid",
    "#mini-calendar",
    "#create-event",
    "#previous-month",
    "#today",
    "#next-month",
    "#event-dialog",
    "#event-dialog-title",
    "#close-event-dialog",
    "#cancel-event",
    "#delete-event",
    "#event-form-error",
    "#event-title",
    "#event-date",
    "#event-calendar",
    "#event-start-time",
    "#event-end-time",
    "#event-notes",
    ".calendar-layout",
    "#ai-schedule-launcher",
    "#ai-schedule-panel",
    "#close-ai-schedule",
    "#ai-schedule-input",
  ];

  requiredSelectors.forEach(createElement);
  const eventForm = new Element(document);
  selectors.get("#event-dialog").queries = { form: eventForm };

  return {
    closeButton: selectors.get("#close-ai-schedule"),
    document,
    input: selectors.get("#ai-schedule-input"),
    launcher: selectors.get("#ai-schedule-launcher"),
    layout: selectors.get(".calendar-layout"),
    panel: selectors.get("#ai-schedule-panel"),
  };
}

test("AI schedule panel controls preserve its draft and accessibility state", async () => {
  const fixture = createAppFixture();
  const storedValues = new Map();
  globalThis.document = fixture.document;
  globalThis.localStorage = {
    getItem: (key) => storedValues.get(key) ?? null,
    setItem: (key, value) => storedValues.set(key, String(value)),
  };
  globalThis.window = { confirm: () => true };

  await import(`../js/app.js?ai-schedule-test=${Date.now()}`);

  fixture.launcher.click();
  assert.equal(fixture.layout.classList.contains("is-ai-schedule-open"), true);
  assert.equal(fixture.launcher.attributes["aria-expanded"], "true");
  assert.equal(fixture.panel.attributes["aria-hidden"], "false");
  assert.equal(fixture.document.activeElement, fixture.input);

  fixture.input.value = "下週三下午三時看醫生";
  fixture.launcher.click();
  assert.equal(fixture.layout.classList.contains("is-ai-schedule-open"), false);
  assert.equal(fixture.input.value, "下週三下午三時看醫生");
  assert.equal(fixture.document.activeElement, fixture.launcher);

  fixture.launcher.click();
  fixture.document.dispatch("keydown", { key: "Escape" });
  assert.equal(fixture.layout.classList.contains("is-ai-schedule-open"), false);

  fixture.launcher.click();
  fixture.closeButton.click();
  assert.equal(fixture.layout.classList.contains("is-ai-schedule-open"), false);
  assert.equal(storedValues.size, 0);
});
