import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import type { readOnboarding } from "@/lib/onboarding";
import styles from "./Onboarding.module.css";

export async function Onboarding({
  progress,
}: {
  progress: ReturnType<typeof readOnboarding>;
}) {
  const [state, t] = await Promise.all([
    progress,
    getTranslations("onboarding"),
  ]);
  if (state.complete) return null;
  const steps = [
    {
      label: t("list"),
      done: Boolean(state.listId),
      href: "/dashboard/wishlists/create",
    },
    {
      label: t("gifts", { count: state.gifts }),
      done: state.gifts >= 3,
      href: state.listId
        ? `/dashboard/wishlists/${state.listId}`
        : "/dashboard/wishlists/create",
    },
    {
      label: t("relative"),
      done: state.relativeInvited,
      href: "/dashboard/family",
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle id="onboarding-heading">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <section aria-labelledby="onboarding-heading" className={styles.panel}>
          <p>
            {t("progress", { count: steps.filter((step) => step.done).length })}
          </p>
          <ol className={styles.steps}>
            {steps.map((step, index) => (
              <li key={index}>
                <span aria-hidden="true" className={styles.marker}>
                  {step.done ? "✓" : index + 1}
                </span>
                <div>
                  {step.done ? (
                    <span>{step.label}</span>
                  ) : (
                    <Link href={step.href}>
                      {step.label} <span aria-hidden="true">→</span>
                    </Link>
                  )}
                  <span className={styles.status}>
                    {t(step.done ? "done" : "todo")}
                  </span>
                </div>
              </li>
            ))}
          </ol>
          <p className={styles.help}>{t("relativeHelp")}</p>
        </section>
      </CardContent>
    </Card>
  );
}
