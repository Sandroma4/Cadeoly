"use client";
import { PreservedForm } from "@/components/ui/PreservedForm";
import { useEffect, useRef, useState } from "react";
import { previewProduct } from "@/app/actions/product-preview";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
  createWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
  restoreWishlistItem,
} from "@/app/actions/item";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { offerQuickUndo } from "@/components/ui/QuickUndo";
import { notify } from "@/components/ui/Toast";
import type { Gift } from "./gift-editor-types";
import { ItemModeChooser } from "./ItemModeChooser";
import { ItemFormFields } from "./ItemFormFields";
import { ItemPreview } from "./ItemPreview";
import { ItemActions } from "./ItemActions";

export function AddItemForm({
  wishlistId,
  item,
  initialUrl = "",
  initialTitle = "",
}: {
  wishlistId: string;
  item?: Gift;
  initialUrl?: string;
  initialTitle?: string;
}) {
  const t = useTranslations("wishlist");
  const currency = item?.currency || "EUR";
  const flow = useTranslations("uiFlow");
  const notices = useTranslations("notifications");
  const [mode, setMode] = useState<"link" | "manual" | null>(
    item ? "manual" : initialUrl ? "link" : initialTitle ? "manual" : null,
  );
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  const [lastMode, setLastMode] = useState<"link" | "manual">("manual");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const fieldError = (name: string) =>
    fieldErrors.includes(name) ? flow("checkField") : undefined;
  const trash = useTranslations("giftTrash");
  const c = useTranslations("common");
  const errors = useTranslations("errors");
  const router = useRouter();
  const chooserRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const importText = useTranslations("productImport");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importedPhoto, setImportedPhoto] = useState("");
  async function importLink() {
    const form = formRef.current;
    if (!form) return;
    const url = (form.elements.namedItem("url") as HTMLInputElement).value;
    setPreview(null);
    setImporting(true);
    setImportMessage("");
    try {
      const result = await previewProduct(wishlistId, url);
      if ((form.elements.namedItem("url") as HTMLInputElement).value !== url)
        return;
      if ("error" in result) {
        setImportMessage(importText("failed"));
        return;
      }
      setDirty(true);
      for (const key of ["title", "price"] as const) {
        const input = form.elements.namedItem(key) as HTMLInputElement;
        if (!input.value && result[key]) input.value = result[key];
      }
      if (!item?.image && result.photo) setImportedPhoto(result.photo);
      form.dispatchEvent(new Event("input", { bubbles: true }));
      setImportMessage(
        importText(
          result.title || result.price || result.photo ? "review" : "failed",
        ),
      );
    } catch {
      setImportMessage(importText("failed"));
    } finally {
      setImporting(false);
    }
  }
  const [open, setOpen] = useState(Boolean(initialUrl || initialTitle));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [localPhoto, setLocalPhoto] = useState("");
  const [dirty, setDirty] = useState(false);
  const photoRead = useRef(0);
  useEffect(() => {
    if (open && !mode) {
      chooserRef.current?.scrollIntoView({ block: "start" });
      chooserRef.current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true });
    }
    if (open && mode) {
      formRef.current?.scrollIntoView({ block: "start" });
      formRef.current
        ?.querySelector<HTMLInputElement>(
          mode === "manual" ? 'input[name="title"]' : 'input[name="url"]',
        )
        ?.focus({ preventScroll: true });
    }
  }, [open, mode]);
  useEffect(() => {
    if (preview)
      formRef.current
        ?.querySelector(".gift-preview")
        ?.scrollIntoView({ block: "nearest" });
  }, [preview]);
  function cancel() {
    if (dirty && !window.confirm(flow("discardDraft"))) return;
    formRef.current?.dispatchEvent(new Event("draft-clear"));
    setOpen(false);
    setPreview(null);
    setMode(item ? "manual" : null);
    setDirty(false);
    setLocalPhoto("");
    setImportedPhoto("");
    setError("");
    photoRead.current++;
  }
  async function submit(form: FormData) {
    if (pending || importing) return;
    if (!preview) {
      const group = item?.isGroupGift || form.get("isGroupGift") === "on";
      if (group && !(Number(form.get("price")) > 0)) {
        setFieldErrors(["price"]);
        setError(errors("groupPriceRequired"));
        return;
      }
      setPreview(
        Object.fromEntries(
          [...form.entries()].filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        ),
      );
      return;
    }
    setPending(true);
    setError("");
    setFieldErrors([]);
    form.set("wishlistId", wishlistId);
    const photo = form.get("photo");
    if (importedPhoto && !(photo instanceof File && photo.size)) {
      const bytes = Uint8Array.from(atob(importedPhoto), (letter) =>
        letter.charCodeAt(0),
      );
      form.set(
        "photo",
        new File([bytes], "product.webp", { type: "image/webp" }),
      );
    }
    try {
      const result = item
        ? await updateWishlistItem(item.id, form)
        : await createWishlistItem(form);
      if (result.error) {
        setError(errors(result.error));
        const invalidFields =
          "fields" in result
            ? result.fields || []
            : result.error === "groupPriceRequired"
              ? ["price"]
              : result.error === "duplicateGift"
                ? ["url"]
                : [];
        setFieldErrors(invalidFields);
        if (invalidFields.includes("url")) setMode("link");
      } else {
        formRef.current?.dispatchEvent(new Event("draft-clear"));
        notify(notices(item ? "giftUpdated" : "giftAdded"));
        setLastMode(mode || "manual");
        setSuccess(flow("giftSaved"));
        setDirty(false);
        setLocalPhoto("");
        photoRead.current++;
        setPreview(null);
        setMode(item ? "manual" : null);
        setOpen(false);
        setImportedPhoto("");
        setImportMessage("");
        router.refresh();
      }
    } catch {
      setError(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  async function remove() {
    if (!item || !window.confirm(trash("confirm"))) return;
    setPending(true);
    setError("");
    try {
      const result = await deleteWishlistItem(item.id);
      if (result.error) setError(errors(result.error));
      else {
        offerQuickUndo({
          message: "giftDeleted",
          undo: () => restoreWishlistItem(item.id),
        });
        router.refresh();
      }
    } catch {
      setError(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  if (!open)
    return (
      <ItemActions
        item={item}
        pending={pending}
        success={success}
        error={error}
        onRemove={remove}
        onOpen={() => {
          setSuccess("");
          if (!item && success) setMode(lastMode);
          setOpen(true);
        }}
      />
    );
  if (!mode)
    return (
      <ItemModeChooser
        chooserRef={chooserRef}
        onChoose={setMode}
        onCancel={cancel}
      />
    );
  const prefix = item?.id || "new";
  return (
    <Card className="gift-editor">
      <CardContent>
        <PreservedForm
          draftKey={`gift:${wishlistId}:${item?.id || "new"}`}
          onDraftRestore={(values) => {
            setDirty(true);
            if (values.url) setMode("link");
          }}
          ref={formRef}
          action={submit}
          className="stack gift-form"
          onInput={() => {
            setPreview(null);
            setFieldErrors([]);
            setDirty(true);
          }}
          onInvalid={(event) => {
            if ((event.target as HTMLInputElement).name === "url")
              setMode("link");
          }}
          aria-busy={pending || importing}
        >
          <h2>{t(item ? "editGift" : "addItem")}</h2>
          <p className="form-hint">{flow("optionalHelp")}</p>
          <p className="form-hint">{flow("draftHelp")}</p>
          <div
            className="button-row"
            role="group"
            aria-label={flow("chooseMode")}
          >
            <Button
              type="button"
              variant={mode === "link" ? "primary" : "secondary"}
              onClick={() => setMode("link")}
            >
              {flow("fromLink")}
            </Button>
            <Button
              type="button"
              variant={mode === "manual" ? "primary" : "secondary"}
              onClick={() => setMode("manual")}
            >
              {flow("manual")}
            </Button>
          </div>
          {error && <p role="alert">{error}</p>}
          {error === errors("duplicateGift") && (
            <label>
              <input type="checkbox" name="allowDuplicate" />{" "}
              {t("allowDuplicate")}
            </label>
          )}
          <div hidden={mode !== "link"}>
            <div className="stack">
              <Input
                id={prefix + "-url"}
                name="url"
                error={fieldError("url")}
                type="url"
                label={t("link")}
                defaultValue={item?.url || initialUrl}
                maxLength={2048}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={pending || importing}
                onClick={importLink}
              >
                {importText(importing ? "loading" : "button")}
              </Button>
              <p>{importText("help")}</p>
              <p role="status">{importMessage}</p>
            </div>
          </div>
          <ItemFormFields
            item={item}
            initialTitle={initialTitle}
            fieldErrors={fieldErrors}
          />
          <Input
            id={prefix + "-photo"}
            type="file"
            name="photo"
            error={fieldError("photo")}
            accept="image/jpeg,image/png,image/webp"
            label={flow("addPhoto")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              const generation = ++photoRead.current;
              setLocalPhoto("");
              setDirty(true);
              setPreview(null);
              if (!file) return;
              if (
                file.size > 5 * 1024 * 1024 ||
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
              ) {
                setFieldErrors(["photo"]);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                if (generation === photoRead.current)
                  setLocalPhoto(String(reader.result));
              };
              reader.readAsDataURL(file);
            }}
            aria-describedby={prefix + "-photo-hint"}
          />
          <p className="form-hint" id={prefix + "-photo-hint"}>
            {t("photoHint")}
          </p>
          {(localPhoto || importedPhoto) && (
            <div className="stack">
              {/* Local preview never contacts the merchant from the browser. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={localPhoto || "data:image/webp;base64," + importedPhoto}
                width={160}
                height={160}
                style={{ objectFit: "contain" }}
                alt={importText("photoAlt")}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setImportedPhoto("");
                  setLocalPhoto("");
                  photoRead.current++;
                  const input = formRef.current?.elements.namedItem(
                    "photo",
                  ) as HTMLInputElement | null;
                  if (input) input.value = "";
                  setDirty(true);
                  setPreview(null);
                }}
              >
                {importText("remove")}
              </Button>
            </div>
          )}
          {item?.image && (
            <label>
              <input type="checkbox" name="removePhoto" /> {t("removePhoto")}
            </label>
          )}
          {preview && (
            <ItemPreview
              preview={preview}
              currency={currency}
              isGroupGift={item?.isGroupGift}
            />
          )}
          <div className="button-row form-actions">
            <Button disabled={pending || importing}>
              {pending
                ? c("saving")
                : preview
                  ? item
                    ? c("save")
                    : flow("addToList")
                  : flow("reviewGift")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || importing}
              onClick={cancel}
            >
              {c("cancel")}
            </Button>
          </div>
        </PreservedForm>
      </CardContent>
    </Card>
  );
}
