"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { saveGuestWishlist } from "@/app/actions/guest-list";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function GuestListForm({
  initial,
}: {
  initial?: {
    id: string;
    name: string;
    description: string | null;
    ownerName?: string;
  };
}) {
  const t = useTranslations("wishlist");
  const guest = useTranslations("guestLists");
  const c = useTranslations("common");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [state, action, pending] = useActionState<
    { error?: string; saved?: boolean },
    FormData
  >(async (_, form) => {
    try {
      const result = await saveGuestWishlist(initial?.id ?? null, form);
      if (!result.success) return { error: result.error };
      if (!initial) router.push(`/guest/lists/${result.wishlistId}`);
      router.refresh();
      return { saved: true };
    } catch {
      return { error: "unexpected" };
    }
  }, {});

  return (
    <form action={action} className="stack" aria-busy={pending}>
      {(!initial || initial.ownerName !== undefined) && (
        <Input
          name="ownerName"
          label={guest("ownerName")}
          autoComplete="given-name"
          defaultValue={initial?.ownerName}
          required={!initial}
          maxLength={120}
        />
      )}
      <Input
        name="name"
        label={t("name")}
        defaultValue={initial?.name}
        placeholder={t("namePlaceholder")}
        required
        maxLength={120}
      />
      <Input
        name="description"
        label={t("description")}
        defaultValue={initial?.description ?? ""}
        maxLength={2000}
      />
      {state.error && <p role="alert">{errors(state.error)}</p>}
      {state.saved && initial && <p role="status">{guest("saved")}</p>}
      <Button disabled={pending}>
        {pending ? c("saving") : initial ? c("save") : t("create")}
      </Button>
    </form>
  );
}
