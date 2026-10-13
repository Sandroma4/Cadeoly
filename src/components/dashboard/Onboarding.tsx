import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { readOnboarding } from "@/lib/onboarding";
import { OnboardingDisclosure } from "./OnboardingDisclosure";
export async function Onboarding({
  progress,
  userId,
}: {
  progress: ReturnType<typeof readOnboarding>;
  userId: string;
}) {
  const [state, t] = await Promise.all([
    progress,
    getTranslations("onboarding"),
  ]);
  if (state.listId && state.gifts > 0) return null;
  return (
    <OnboardingDisclosure
      userId={userId}
      label={t(state.listId ? "firstGift" : "list")}
      hideLabel={t("hide")}
    >
      <Link
        href={
          state.listId
            ? "/dashboard/wishlists/" + state.listId
            : "/dashboard/wishlists/create"
        }
      >
        {t(state.listId ? "firstGift" : "list")}{" "}
        <span aria-hidden="true">→</span>
      </Link>
    </OnboardingDisclosure>
  );
}
