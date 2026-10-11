import { cookies } from "next/headers";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

export async function PublicListHeader() {
  const t = await getTranslations("publicList");
  const preferences = await cookies();
  const choice =
    preferences.get("cadeoly-theme")?.value ??
    preferences.get("wishi-theme")?.value;
  const theme = choice === "light" || choice === "dark" ? choice : "system";

  return (
    <header className="public-list-header">
      <div className="public-header-row">
        <Link href="/" aria-label={t("home")}>
          <BrandLogo />
        </Link>
        <div className="public-header-controls">
          <LanguageSwitcher />
          <ThemeSwitcher initial={theme} />
        </div>
      </div>
      <p>{t("help")}</p>
    </header>
  );
}
