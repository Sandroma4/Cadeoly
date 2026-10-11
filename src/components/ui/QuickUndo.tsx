"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
type UndoOffer = {
  message: "reservationCancelled" | "giftDeleted";
  undo: () => Promise<{ error?: string }>;
};
const eventName = "cadeoly:quick-undo";
export function offerQuickUndo(offer: UndoOffer) {
  window.dispatchEvent(new CustomEvent(eventName, { detail: offer }));
}
export function QuickUndo() {
  const pathname = usePathname();
  return <QuickUndoNotice key={pathname} />;
}
function QuickUndoNotice() {
  const [offer, setOffer] = useState<UndoOffer | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const version = useRef(0);
  const t = useTranslations("quickUndo");
  const errors = useTranslations("errors");
  const router = useRouter();
  useEffect(() => {
    const lifecycle = version;
    const receive = (event: Event) => {
      lifecycle.current++;
      setError("");
      setPending(false);
      setOffer((event as CustomEvent<UndoOffer>).detail);
    };
    window.addEventListener(eventName, receive);
    return () => {
      lifecycle.current++;
      window.removeEventListener(eventName, receive);
    };
  }, []);
  useEffect(() => {
    if (!offer || pending) return;
    const timeout = setTimeout(() => setOffer(null), 12000);
    return () => clearTimeout(timeout);
  }, [offer, pending]);
  async function undo() {
    if (!offer || pending) return;
    const current = version.current;
    setPending(true);
    setError("");
    try {
      const result = await offer.undo();
      if (current !== version.current) return;
      if (result.error) setError(errors(result.error));
      else {
        setOffer(null);
        router.refresh();
      }
    } catch {
      if (current === version.current) setError(errors("unexpected"));
    } finally {
      if (current === version.current) setPending(false);
    }
  }
  if (!offer) return null;
  return (
    <aside
      className="card stack quick-undo"
      style={{
        position: "fixed",
        left: "1rem",
        right: "1rem",
        maxWidth: "32rem",
        zIndex: 100,
        padding: "1rem",
      }}
      aria-busy={pending}
    >
      <p role="status">{t(offer.message)}</p>
      <div className="button-row">
        <Button disabled={pending} onClick={undo}>
          {t("undo")}
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => setOffer(null)}
        >
          {t("dismiss")}
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
