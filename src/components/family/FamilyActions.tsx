"use client";
import { useRef, useState, useId } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { CreateFamilyForm } from "./CreateFamilyForm";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { invitationPath } from "@/lib/invitation-link";

export function FamilyActions({ join = false }: { join?: boolean }) {
  const t = useTranslations("auditUI");
  const family = useTranslations("family");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [error, setError] = useState("");
  function open(next: "create" | "join") {
    setMode(next);
    setError("");
    dialog.current?.showModal();
  }
  return (
    <div className="family-actions">
      <Button onClick={() => open("create")}>{family("createFamily")}</Button>
      {join && (
        <Button
          variant="secondary"
          className="join-family-action"
          onClick={() => open("join")}
        >
          {t("join")}
        </Button>
      )}
      <dialog ref={dialog} className="family-dialog" aria-labelledby={titleId}>
        <header className="dialog-heading">
          <h2 id={titleId}>
            {mode === "create" ? family("createFamily") : t("join")}
          </h2>
          <Button
            variant="secondary"
            onClick={() => dialog.current?.close()}
            aria-label={t("close")}
          >
            ×
          </Button>
        </header>
        {mode === "create" ? (
          <CreateFamilyForm
            showTitle={false}
            onCreated={() => {
              dialog.current?.close();
              router.refresh();
            }}
          />
        ) : (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const path = invitationPath(
                String(
                  new FormData(event.currentTarget).get("invitation") || "",
                ),
              );
              if (!path) {
                setError(t("invalidInvitation"));
                return;
              }
              dialog.current?.close();
              router.push(path);
            }}
          >
            <p>{t("invitationHelp")}</p>
            <Input
              name="invitation"
              label={t("invitationLabel")}
              required
              maxLength={2048}
              error={error || undefined}
            />
            <Button type="submit">{t("openInvitation")}</Button>
          </form>
        )}
      </dialog>
    </div>
  );
}
