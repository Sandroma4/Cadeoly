"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AddItemForm } from "./AddItemForm";
import { Link } from "@/i18n/routing";
export function QuickAdd({
  lists,
  url,
  title,
  price = "",
  image = "",
}: {
  lists: { id: string; name: string }[];
  url: string;
  title: string;
  price?: string;
  image?: string;
}) {
  const t = useTranslations("convenience");
  const [id, setId] = useState(lists[0]?.id || "");
  return (
    <div className="stack">
      <h1>{t("quickAdd")}</h1>
      <p>{t("quickHelp")}</p>
      {lists.length ? (
        <>
          <label htmlFor="quick-list">{t("chooseList")}</label>
          <select
            id="quick-list"
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <AddItemForm
            key={id}
            wishlistId={id}
            initialUrl={url}
            initialTitle={title}
            initialPrice={price}
            initialImage={image}
          />
          <Link href={`/dashboard/wishlists/${id}`}>{t("openList")}</Link>
        </>
      ) : (
        <Link
          className="primary-link"
          href={`/dashboard/wishlists/create?${new URLSearchParams({ url, title, price, image })}`}
        >
          {t("createFirst")}
        </Link>
      )}
    </div>
  );
}
