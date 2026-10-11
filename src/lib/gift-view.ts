export type GiftView = "photos" | "compact";
let fallback: GiftView = "photos";
const key = "cadeoly-gift-view";
export function readGiftView(): GiftView {
  try {
    const saved = window.localStorage.getItem(key);
    return saved === "photos" || saved === "compact" ? saved : fallback;
  } catch {
    return fallback;
  }
}
export function subscribeGiftView(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(key, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(key, listener);
  };
}
export function setGiftView(view: GiftView) {
  fallback = view;
  try {
    window.localStorage.setItem(key, view);
  } catch {}
  window.dispatchEvent(new Event(key));
}
export function serverGiftView(): GiftView {
  return "photos";
}
