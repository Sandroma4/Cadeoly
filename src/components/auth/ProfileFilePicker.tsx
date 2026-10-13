"use client";
import { type ChangeEvent, type RefObject, useId } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import styles from "@/app/[locale]/dashboard/profile/page.module.css";

export function ProfileFilePicker({
  inputRef,
  label,
  accept,
  name,
  selectedName,
  disabled,
  onChange,
  onClear,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  label: string;
  accept: string;
  name?: string;
  selectedName: string;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  const id = useId();
  const t = useTranslations("profileSettings");
  return (
    <div className={styles.filePicker}>
      <label htmlFor={id} className={styles.srOnly}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        name={name}
        accept={accept}
        disabled={disabled}
        onChange={onChange}
        className={styles.hiddenFile}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" />
        </svg>
        {label}
      </Button>
      {selectedName && (
        <div className={styles.selectedFile}>
          <span>{selectedName}</span>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            aria-label={t("clearFile")}
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              onClear();
            }}
          >
            ×
          </Button>
        </div>
      )}
    </div>
  );
}
