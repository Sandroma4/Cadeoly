"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { saveGuestItem, deleteGuestItem } from "@/app/actions/guest-list";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function GuestItemForm({
  wishlistId,
  item,
}: {
  wishlistId: string;
  item?: {
    id: string;
    title: string;
    description: string | null;
    url: string | null;
    priceCents: number | null;
  };
}) {
  const t = useTranslations("wishlist");
  const c = useTranslations("common");
  const guest = useTranslations("guestLists");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [state, action, pending] = useActionState<
    { error?: string; saved?: boolean },
    FormData
  >(async (_, form) => {
    try {
      const result =
        item && form.get("intent") === "delete"
          ? await deleteGuestItem(wishlistId, item.id)
          : await saveGuestItem(wishlistId, item?.id ?? null, form);
      if (!result.success) return { error: result.error };
      router.refresh();
      return { saved: true };
    } catch {
      return { error: "unexpected" };
    }
  }, {});

  return (
    <form action={action} className="stack" aria-busy={pending}>
      <Input
        name="title"
        label={t("giftName")}
        defaultValue={item?.title}
        required
        maxLength={120}
      />
      <Input
        name="url"
        label={t("link")}
        type="url"
        defaultValue={item?.url ?? ""}
        maxLength={2048}
      />
      <Input
        name="price"
        label={t("price")}
        type="number"
        min="0"
        max="9999999.99"
        step="0.01"
        defaultValue={
          item?.priceCents == null ? "" : (item.priceCents / 100).toFixed(2)
        }
      />
      <Input
        name="description"
        label={t("description")}
        defaultValue={item?.description ?? ""}
        maxLength={2000}
      />
      {state.error && <p role="alert">{errors(state.error)}</p>}
      {state.saved && <p role="status">{guest("saved")}</p>}
      <div className="button-row">
        <Button disabled={pending}>
          {pending ? c("saving") : item ? c("save") : t("addGift")}
        </Button>
        {item && (
          <Button
            name="intent"
            value="delete"
            variant="danger"
            disabled={pending}
            formNoValidate
          >
            {c("delete")}
          </Button>
        )}
      </div>
    </form>
  );
}
