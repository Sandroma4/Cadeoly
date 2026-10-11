"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { duplicateEvent } from "@/app/actions/event-duplicate";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function EventDuplicateForm({
  event,
}: {
  event: { id: string; name: string };
}) {
  const t = useTranslations("events"),
    c = useTranslations("common"),
    errors = useTranslations("errors");
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  async function submit(form: FormData) {
    setPending(true);
    setMessage("");
    try {
      const result = await duplicateEvent(event.id, form);
      if (result.error) setMessage(errors(result.error));
      else if ("eventId" in result && result.eventId) {
        router.push(`/dashboard/events/${result.eventId}`);
        router.refresh();
      }
    } catch {
      setMessage(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  return (
    <details>
      <summary>{t("duplicate")}</summary>
      <form
        id="duplicate-event-form"
        className="stack"
        action={submit}
        aria-describedby="duplicate-event-help"
      >
        <p id="duplicate-event-help">{t("duplicateHelp")}</p>
        <Input
          id="duplicate-event-name"
          name="name"
          label={t("name")}
          defaultValue={event.name}
          required
          maxLength={120}
        />
        <Input
          id="duplicate-event-date"
          name="date"
          type="date"
          label={t("date")}
          required
        />
        <Button disabled={pending}>
          {pending ? c("saving") : t("duplicate")}
        </Button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
