"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import styles from "@/app/[locale]/guest/page.module.css";

interface DemoItem {
  id: string;
  titleKey?: string;
  customTitle?: string;
  status: "available" | "reserved" | "group";
}

export function GuestInteractiveDemo({ locale }: { locale: string }) {
  const t = useTranslations("guest");
  const home = useTranslations("home");

  const [items, setItems] = useState<DemoItem[]>([
    { id: "book", titleKey: "examplebook", status: "available" },
    { id: "headphones", titleKey: "exampleheadphones", status: "reserved" },
    { id: "weekend", titleKey: "exampleweekend", status: "group" },
  ]);

  const [newTitle, setNewTitle] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  function toggleReserve(id: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextStatus = item.status === "available" ? "reserved" : "available";
        if (nextStatus === "reserved") {
          setFeedback(t("demoReservedSuccess"));
        } else {
          setFeedback(null);
        }
        return { ...item, status: nextStatus };
      }),
    );
  }

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newItem: DemoItem = {
      id: `custom-${Date.now()}`,
      customTitle: newTitle.trim(),
      status: "available",
    };
    setItems((prev) => [newItem, ...prev]);
    setNewTitle("");
    setFeedback(t("demoAddedSuccess"));
  }

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      {feedback && (
        <div
          role="status"
          style={{
            padding: "0.85rem 1rem",
            borderRadius: "var(--radius)",
            background: "color-mix(in srgb, var(--primary) 12%, var(--card))",
            border: "1px solid color-mix(in srgb, var(--primary) 30%, var(--border))",
            color: "var(--foreground)",
            fontWeight: 500,
            fontSize: "0.9rem",
          }}
        >
          {feedback}
        </div>
      )}

      {/* Simulator: Add gift */}
      <form
        onSubmit={handleAddItem}
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "flex-end",
          flexWrap: "wrap",
          padding: "1rem",
          background: "var(--secondary)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ flex: "1 1 200px" }}>
          <Input
            label={t("demoAddTitle")}
            placeholder={t("demoAddPlaceholder")}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            maxLength={100}
          />
        </div>
        <Button type="submit" variant="secondary">
          {t("demoAddButton")}
        </Button>
      </form>

      {/* Gifts grid */}
      <div className="gift-grid">
        {items.map((item) => {
          const title = item.titleKey ? home(item.titleKey) : item.customTitle;
          const isReserved = item.status === "reserved";
          const isGroup = item.status === "group";

          return (
            <Card key={item.id}>
              <CardHeader>
                <div className={styles.icon}>
                  <OccasionIcon kind="gift" />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{home("exampleTitle")}</CardDescription>
              </CardHeader>
              <CardContent className="stack" style={{ gap: "0.75rem" }}>
                <span className="visual-badge">
                  {home(
                    item.status === "available"
                      ? "available"
                      : isReserved
                        ? "reserved"
                        : "group",
                  )}
                </span>
                {!isGroup && (
                  <Button
                    variant={isReserved ? "ghost" : "secondary"}
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.75rem" }}
                    onClick={() => toggleReserve(item.id)}
                  >
                    {isReserved
                      ? t("demoUnreserveAction")
                      : t("demoReserveAction")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
