// Vitest 全域 setup：jsdom 未實作原生 <dialog> 的 showModal()/close()，補最小 polyfill。
if (typeof HTMLDialogElement === "function") {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
