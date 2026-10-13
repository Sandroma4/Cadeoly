"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { createRecipient, updateRecipient } from "@/app/actions/recipient";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PreservedForm } from "@/components/ui/PreservedForm";
import styles from "@/app/[locale]/dashboard/profile/page.module.css";
export function RecipientManager({
  recipients,
}: {
  recipients: { id: string; name: string }[];
}) {
  const t = useTranslations("convenience"),
    p = useTranslations("improvements"),
    errors = useTranslations("errors"),
    router = useRouter();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const settings = useTranslations("profileSettings");
  const add = useRef<HTMLDetailsElement>(null);
  async function run(
    action: () => Promise<{ error?: string; success?: boolean }>,
  ) {
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      const result = await action();
      setMessage(result.error ? errors(result.error) : p("recipientUpdated"));
      if (!result.error) {
        if (add.current) add.current.open = false;
        router.refresh();
      }
    } catch {
      setMessage(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="stack" aria-labelledby="recipients-heading">
      <h2 id="recipients-heading">{t("recipients")}</h2>
      <p>{t("recipientHelp")}</p>
      {!recipients.length && (
        <p className={styles.hint}>{settings("noPeople")}</p>
      )}
      <div className="stack">
        {recipients.map((r) => (
          <details className="recipient-row" key={r.id}>
            <summary>{r.name}</summary>
            <div className="stack">
              <PreservedForm
                className="stack"
                aria-busy={pending}
                action={(form) => run(() => updateRecipient(r.id, form))}
              >
                <input type="hidden" name="operation" value="rename" />
                <Input
                  name="name"
                  label={p("renameRecipient")}
                  defaultValue={r.name}
                  maxLength={120}
                  required
                />
                <Button disabled={pending}>{p("rename")}</Button>
              </PreservedForm>
              {recipients.length > 1 && (
                <PreservedForm
                  className="stack"
                  aria-busy={pending}
                  action={(form) => {
                    if (window.confirm(p("confirmMerge", { name: r.name })))
                      return run(() => updateRecipient(r.id, form));
                  }}
                >
                  <input type="hidden" name="operation" value="merge" />
                  <label>
                    {p("mergeInto")}
                    <select
                      name="targetId"
                      defaultValue={
                        recipients.find((other) => other.id !== r.id)?.id
                      }
                    >
                      {recipients
                        .filter((other) => other.id !== r.id)
                        .map((other) => (
                          <option key={other.id} value={other.id}>
                            {other.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Button variant="secondary" disabled={pending}>
                    {p("merge")}
                  </Button>
                </PreservedForm>
              )}
              <Button
                variant="danger"
                disabled={pending}
                onClick={() => {
                  if (
                    window.confirm(
                      p("confirmDeleteRecipient", { name: r.name }),
                    )
                  ) {
                    const form = new FormData();
                    form.set("operation", "delete");
                    void run(() => updateRecipient(r.id, form));
                  }
                }}
              >
                {p("deleteRecipient")}
              </Button>
            </div>
          </details>
        ))}
      </div>
      <details ref={add} className={styles.addPerson}>
        <summary>+ {settings("addPerson")}</summary>
        <PreservedForm
          className="stack"
          aria-busy={pending}
          action={(form) => run(() => createRecipient(form))}
        >
          <Input
            name="name"
            label={t("recipientName")}
            maxLength={120}
            required
          />
          <Button disabled={pending}>{t("addRecipient")}</Button>
        </PreservedForm>
      </details>
      <p role="status">{message}</p>
    </section>
  );
}
