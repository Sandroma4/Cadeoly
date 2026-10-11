"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { reserveItem } from "@/app/actions/item";
import {
  cancelReservationWithUndo,
  restoreReservation,
} from "@/app/actions/reservation-preparation";
import { offerQuickUndo } from "@/components/ui/QuickUndo";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { notify } from "@/components/ui/Toast";
export function ReserveButton({
  itemId,
  isReserved,
  reservedByMe,
  token,
}: {
  itemId: string;
  isReserved: boolean;
  reservedByMe: boolean;
  token?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const t = useTranslations("wishlist");
  const errors = useTranslations("errors");
  const sharing = useTranslations("sharing");
  const notices = useTranslations("notifications");
  async function click() {
    setPending(true);
    setError("");
    try {
      const result = reservedByMe
        ? await cancelReservationWithUndo(itemId)
        : await reserveItem(itemId, token);
      if (result.error) setError(errors(result.error));
      else if ("undo" in result && result.undo) {
        const snapshot = result.undo;
        offerQuickUndo({
          message: "reservationCancelled",
          undo: () => restoreReservation(itemId, snapshot),
        });
      } else if (!reservedByMe) notify(notices("reserved"));
      router.refresh();
    } catch {
      setError(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="stack" aria-busy={pending}>
      <Button
        disabled={pending || (isReserved && !reservedByMe)}
        variant={isReserved ? "secondary" : "primary"}
        onClick={click}
      >
        {pending
          ? sharing("pending")
          : t(
              reservedByMe
                ? "cancelReservation"
                : isReserved
                  ? "reserved"
                  : "reserve",
            )}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
