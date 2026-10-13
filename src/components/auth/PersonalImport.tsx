"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { ProfileFilePicker } from "./ProfileFilePicker";
import styles from "@/app/[locale]/dashboard/profile/page.module.css";
import { Button } from "@/components/ui/Button";
type Preview = {
  lists: { name: string; gifts: number; photos: number }[];
  gifts: number;
};
export function PersonalImport() {
  const t = useTranslations("improvements"),
    router = useRouter();
  const settings = useTranslations("profileSettings");
  const [selectedName, setSelectedName] = useState("");
  const source = useRef<unknown>(null),
    file = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  async function submit(confirm: boolean) {
    if (pending) return;
    setPending(true);
    setMessage("");
    setError(false);
    try {
      if (!confirm) {
        const selected = file.current?.files?.[0];
        if (!selected || selected.size > 20 * 1024 * 1024)
          throw new Error("invalid");
        source.current = JSON.parse(await selected.text());
      }
      const response = await fetch("/api/account-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: source.current, confirm }),
      });
      if (!response.ok)
        throw new Error(response.status === 429 ? "retry" : "invalid");
      const data = await response.json();
      if (confirm) {
        setPreview(null);
        source.current = null;
        if (file.current) file.current.value = "";
        setSelectedName("");
        setMessage(t("imported", { lists: data.lists, gifts: data.gifts }));
        router.refresh();
      } else setPreview(data);
    } catch (cause) {
      setError(true);
      setMessage(
        t(
          cause instanceof Error && cause.message === "retry"
            ? "retry"
            : "invalidImport",
        ),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="stack" aria-labelledby="import-heading">
      <h3 id="import-heading">{settings("importTitle")}</h3>
      <p>{settings("importHelp")}</p>
      <details className={styles.help}>
        <summary>{settings("learnMore")}</summary>
        <p>{t("importHelp")}</p>
      </details>
      <ProfileFilePicker
        inputRef={file}
        selectedName={selectedName}
        accept="application/json,.json"
        label={t("importFile")}
        disabled={pending}
        onClear={() => {
          setSelectedName("");
          setPreview(null);
          setMessage("");
          source.current = null;
        }}
        onChange={(event) => {
          setSelectedName(event.target.files?.[0]?.name || "");
          setPreview(null);
          setMessage("");
          source.current = null;
        }}
      />
      <Button
        variant="secondary"
        disabled={pending || !selectedName}
        onClick={() => void submit(false)}
      >
        {pending ? t("working") : t("previewImport")}
      </Button>
      {preview && (
        <div className="stack import-preview">
          <h3>{t("importPreview")}</h3>
          <ul>
            {preview.lists.map((list, i) => (
              <li key={i}>
                {list.name} ·{" "}
                {t("importCounts", { gifts: list.gifts, photos: list.photos })}
              </li>
            ))}
          </ul>
          <p>{t("importCopies")}</p>
          <Button
            disabled={pending || !preview.lists.length}
            onClick={() => void submit(true)}
          >
            {t("confirmImport")}
          </Button>
        </div>
      )}
      <p role={error ? "alert" : "status"}>{message}</p>
    </section>
  );
}
