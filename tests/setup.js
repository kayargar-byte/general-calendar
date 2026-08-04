// Vitest 全域 setup：jsdom 未實作原生 <dialog> 的 showModal()/close()，補最小 polyfill。
// pdf.js 及其 worker 在 jsdom 無法真正運行，全域 mock 供 mount App／ManageDialog 的測試使用。
import { vi } from "vitest";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?worker", () => ({
  default: class PdfWorkerMock {},
}));

if (typeof HTMLDialogElement === "function") {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
