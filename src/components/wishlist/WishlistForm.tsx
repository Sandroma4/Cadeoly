"use client";
import { Visibility } from "@/lib/domain-values";
import { PreservedForm } from "@/components/ui/PreservedForm";
import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { createWishlist, updateWishlist } from "@/app/actions/wishlist";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { notify } from "@/components/ui/Toast";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import { nextOccasionDate } from "@/lib/occasion-date";
export function WishlistForm({
  events,
  initial,
  defaultEventId,
  hasFamily = true,
  recipients = [],
  quickAdd,
  guestMode = false,
}: {
  guestMode?: boolean;
  events: { id: string; name: string }[];
  defaultEventId?: string;
  hasFamily?: boolean;
  recipients?: { id: string; name: string }[];
  quickAdd?: { url: string; title: string };
  initial?: {
    id: string;
    name: string;
    description: string | null;
    visibility: string;
    eventId: string | null;
    occasion?: string | null;
    neededBy?: string | null;
    preferences?: string | null;
    recipientId?: string | null;
  };
}) {
  const t = useTranslations("wishlist");
  const accountText = useTranslations("guestAccount");
  const notices = useTranslations("notifications");
  const flow = useTranslations("uiFlow");
  const help = useTranslations("usageHelp");
  const [visibility, setVisibility] = useState(
    guestMode
      ? "PRIVATE"
      : initial?.visibility || (hasFamily ? "FAMILY" : "PRIVATE"),
  );
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const fieldError = (name: string) =>
    fieldErrors.includes(name) ? flow("checkField") : undefined;
  const c = useTranslations("common");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(form: FormData) {
    if (pending) return;
    setSaved(false);
    setFieldErrors([]);
    setPending(true);
    setError("");
    try {
      const result = initial
        ? await updateWishlist(initial.id, form)
        : await createWishlist(form);
      if (result.error) {
        setError(errors(result.error));
        setFieldErrors("fields" in result ? result.fields || [] : []);
      } else {
        notify(notices(initial ? "listUpdated" : "listCreated"));
        document
          .querySelector<HTMLFormElement>(".list-form")
          ?.dispatchEvent(new Event("draft-clear"));
        setSaved(true);
        if ("wishlistId" in result)
          router.push(
            quickAdd
              ? `/quick-add?${new URLSearchParams(quickAdd)}`
              : "/dashboard/wishlists/" + result.wishlistId,
          );
        router.refresh();
      }
    } catch {
      setError(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  return (
    <PreservedForm
      draftKey={`wishlist:${initial?.id || "new"}`}
      onDraftRestore={(values) => {
        if (
          !guestMode &&
          ["PRIVATE", "FAMILY", "LINK", "PUBLIC"].includes(values.visibility)
        )
          setVisibility(values.visibility);
      }}
      action={submit}
      className="stack list-form"
      aria-busy={pending}
    >
      <div className="list-form-header">
        <div className="list-form-badge" aria-hidden="true">
          <OccasionIcon kind="gift" />
        </div>
        <div className="list-form-title-group">
          {initial ? <h2>{t("editTitle")}</h2> : <h1>{t("createTitle")}</h1>}
          <p className="list-form-subtitle">{t("intro")}</p>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">{flow("listSaved")}</p>}

      <div className="list-form-grid-2">
        {!initial && (
          <label className="list-form-field">
            <span className="field-label-row">{t("template")}</span>
            <select
              onChange={(event) => {
                const kind = event.target.value;
                const form = event.currentTarget.form;
                if (!form || !kind) return;
                const name = form.elements.namedItem(
                  "name",
                ) as HTMLInputElement;
                if (name.value && !window.confirm(t("replaceTemplate"))) return;
                name.value = t("template" + kind);
                const occasion = form.elements.namedItem(
                  "occasion",
                ) as HTMLInputElement;
                occasion.value = name.value;
                const neededBy = form.elements.namedItem(
                  "neededBy",
                ) as HTMLInputElement;
                neededBy.value = nextOccasionDate(kind);
                form.dispatchEvent(new Event("input", { bubbles: true }));
              }}
              defaultValue=""
            >
              <option value="">{t("blankTemplate")}</option>
              {[
                "Birthday",
                "Christmas",
                "Easter",
                "SaintNicholas",
                "Wedding",
                "Birth",
              ].map((kind) => (
                <option key={kind} value={kind}>
                  {
                    {
                      Birthday: "🎂",
                      Christmas: "🎄",
                      Easter: "🐣",
                      SaintNicholas: "🎅",
                      Wedding: "💍",
                      Birth: "👶",
                    }[kind]
                  }{" "}
                  {t("template" + kind)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="list-form-field">
          <span className="field-label-row">{t("recipient")}</span>
          <select name="recipientId" defaultValue={initial?.recipientId || ""}>
            <option value="">{t("myself")}</option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="list-form-field">
        <Input
          id="list-name"
          name="name"
          error={fieldError("name")}
          label={t("name")}
          defaultValue={initial?.name}
          placeholder={t("namePlaceholder")}
          required
          maxLength={120}
        />
      </div>

      <div className="list-form-field">
        <label htmlFor="visibility">
          <span className="field-label-row">{t("visibility")}</span>
        </label>
        <select
          id="visibility"
          name="visibility"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value)}
          aria-describedby="visibility-help"
        >
          {Object.values(Visibility).map((value) => (
            <option
              key={value}
              value={value}
              disabled={guestMode && value !== "PRIVATE"}
            >
              {t("visibility" + value[0] + value.slice(1).toLowerCase())}
            </option>
          ))}
        </select>
        <div id="visibility-help" className="visibility-callout">
          <span className="callout-dot" aria-hidden="true" />
          <span>{help(visibility.toLowerCase() + "Help")}</span>
        </div>
      </div>

      <details
        className="form-options styled-details"
        open={defaultEventId ? true : undefined}
      >
        <summary className="styled-summary">
          <span className="summary-title-row">
            <span className="summary-icon" aria-hidden="true">
              ⚙
            </span>
            <span>{flow("moreOptions")}</span>
          </span>
        </summary>
        <div className="stack options-content">
          {guestMode && (
            <p className="form-hint">{accountText("sharingHelp")}</p>
          )}
          {!initial && !hasFamily && (
            <p className="form-hint">{help("noFamilyHelp")}</p>
          )}
          <Input
            id="list-description"
            name="description"
            error={fieldError("description")}
            label={t("description")}
            defaultValue={initial?.description || ""}
            maxLength={2000}
          />
          <div className="list-form-grid-2">
            <Input
              name="occasion"
              error={fieldError("occasion")}
              label={t("occasion")}
              defaultValue={initial?.occasion || ""}
              maxLength={120}
            />
            <Input
              name="neededBy"
              error={fieldError("neededBy")}
              label={t("neededBy")}
              type="date"
              defaultValue={initial?.neededBy || ""}
            />
          </div>
          <label htmlFor="list-preferences" className="list-form-field">
            <span className="field-label-row">{t("preferences")}</span>
            <textarea
              id="list-preferences"
              name="preferences"
              defaultValue={initial?.preferences || ""}
              maxLength={2000}
              rows={3}
              aria-invalid={fieldErrors.includes("preferences")}
              aria-describedby="preferences-help"
            />
          </label>
          <p id="preferences-help" className="form-hint">
            {fieldError("preferences") || t("preferencesHint")}
          </p>
          <label htmlFor="list-event" className="list-form-field">
            <span className="field-label-row">{t("event")}</span>
            <select
              id="list-event"
              name="eventId"
              defaultValue={initial?.eventId || defaultEventId || ""}
            >
              <option value="">{t("noEvent")}</option>
              {events.map((event) => (
                <option value={event.id} key={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>

      <div className="button-row form-actions list-form-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          className="list-cancel-btn"
        >
          {c("cancel")}
        </Button>
        <Button type="submit" disabled={pending} className="list-submit-btn">
          {pending ? c("saving") : c("save")}
        </Button>
      </div>
    </PreservedForm>
  );
}
