"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { saveGiftFavorite } from "@/app/actions/gift-favorite";

export function FavoriteButton({
  itemId,
  isFavorite,
}: {
  itemId: string;
  isFavorite: boolean;
}) {
  const t = useTranslations("giftFavorites");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function click() {
    setPending(true);
    setError("");
    try {
      const result = await saveGiftFavorite(itemId, !isFavorite);
      if ("error" in result && result.error) setError(errors(result.error));
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
        variant="secondary"
        disabled={pending}
        aria-pressed={isFavorite}
        onClick={click}
      >
        {t(isFavorite ? "remove" : "save")}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
