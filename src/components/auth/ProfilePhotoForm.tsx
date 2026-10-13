"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { saveProfilePhoto } from "@/app/actions/profile-photo";
import { profilePhotoUrl } from "@/lib/profile-photo-url";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/Button";
import { ProfileFilePicker } from "./ProfileFilePicker";
import styles from "@/app/[locale]/dashboard/profile/page.module.css";

export function ProfilePhotoForm({
  userId,
  name,
  photo,
  visibility,
}: {
  userId: string;
  name: string;
  photo: string | null;
  visibility: string;
}) {
  const t = useTranslations("profileSettings");
  const errors = useTranslations("errors");
  const c = useTranslations("common");
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [selectedVisibility, setSelectedVisibility] = useState(visibility);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function submit(form: FormData, visibilityOnly = false) {
    if (pending) return;
    setPending(true);
    setMessage("");
    setError(false);
    try {
      const result = await saveProfilePhoto(form);
      if (result.error) {
        setError(true);
        setMessage(errors(result.error));
      } else {
        setMessage(
          t(form.get("operation") === "remove" ? "photoRemoved" : "photoSaved"),
        );
        if (!visibilityOnly) {
          setPreview(null);
          setSelectedName("");
          if (file.current) file.current.value = "";
        }
        router.refresh();
      }
    } catch {
      setError(true);
      setMessage(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      id="profile-identity"
      className={styles.card}
      aria-labelledby="identity-heading"
    >
      <h2 id="identity-heading">{t("photo")}</h2>
      <form
        action={(form) => submit(form)}
        className="stack"
        aria-busy={pending}
      >
        <div className={styles.photoRow}>
          <UserAvatar
            name={name}
            src={preview || (photo ? profilePhotoUrl(userId, photo) : null)}
            size={88}
          />
          <div className="stack">
            <ProfileFilePicker
              inputRef={file}
              label={t("choosePhoto")}
              selectedName={selectedName}
              onClear={() => {
                setPreview(null);
                setSelectedName("");
                setMessage("");
              }}
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              disabled={pending}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected && selected.size > 5 * 1024 * 1024) {
                  setError(true);
                  setMessage(errors("invalidPhoto"));
                  event.target.value = "";
                  setPreview(null);
                  setSelectedName("");
                  return;
                }
                setPreview(selected ? URL.createObjectURL(selected) : null);
                setSelectedName(selected?.name || "");
                setMessage("");
              }}
            />
            <p id="photo-help" className={styles.hint}>
              {t("photoHelpCompact")}
            </p>
          </div>
        </div>
        <label htmlFor="profile-photo-visibility">{t("visibility")}</label>
        <select
          id="profile-photo-visibility"
          name="visibility"
          value={selectedVisibility}
          disabled={pending}
          aria-describedby="photo-privacy"
          onChange={(event) => {
            setSelectedVisibility(event.target.value);
            const form = new FormData();
            form.set("visibility", event.target.value);
            void submit(form, true);
          }}
        >
          <option value="PRIVATE">{t("private")}</option>
          <option value="FAMILY">{t("family")}</option>
          <option value="MEMBERS">{t("members")}</option>
        </select>
        <details id="photo-privacy" className={styles.help}>
          <summary>{t("learnMore")}</summary>
          <p className={styles.hint}>{t("privacyHelp")}</p>
        </details>
        <div className="button-row">
          {selectedName && (
            <Button disabled={pending}>{c(pending ? "saving" : "save")}</Button>
          )}
          {photo && (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                const form = new FormData();
                form.set("operation", "remove");
                void submit(form);
              }}
            >
              {t("removePhoto")}
            </Button>
          )}
        </div>
        {message && <p role={error ? "alert" : "status"}>{message}</p>}
      </form>
    </section>
  );
}
