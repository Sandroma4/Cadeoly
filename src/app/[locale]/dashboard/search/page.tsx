import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchDashboard } from "@/lib/dashboard-search";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { redirect } from "next/navigation";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const session = await auth(),
    locale = await getLocale();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const params = await searchParams;
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const t = await getTranslations("globalSearch");
  const results = await searchDashboard(prisma, session.user.id, query);
  const total =
    results.lists.length + results.gifts.length + results.events.length;
  return (
    <div className="stack">
      <header className="page-heading">
        <h1>{t("title")}</h1>
        <p className="page-intro">{t("help")}</p>
      </header>
      <form
        action={`/${locale}/dashboard/search`}
        method="get"
        className="stack focused-page"
      >
        <Input
          name="q"
          type="search"
          label={t("query")}
          defaultValue={query}
          minLength={2}
          maxLength={120}
          required
        />
        <Button>{t("submit")}</Button>
      </form>
      {query.length < 2 ? (
        <p>{t("start")}</p>
      ) : (
        <>
          <p role="status">{t("count", { count: total })}</p>
          {!total && <p>{t("empty")}</p>}
          {(["lists", "gifts", "events"] as const).map(
            (kind) =>
              results[kind].length > 0 && (
                <section
                  className="stack"
                  key={kind}
                  aria-labelledby={`search-${kind}`}
                >
                  <h2 id={`search-${kind}`}>{t(kind)}</h2>
                  <ul className="global-search-results">
                    {results[kind].map((result) => (
                      <li key={result.id}>
                        <Link href={result.href}>{result.title}</Link>
                        {"listName" in result && <p>{result.listName}</p>}
                        {"date" in result && (
                          <time dateTime={result.date.toISOString()}>
                            {new Intl.DateTimeFormat(locale, {
                              dateStyle: "long",
                              timeZone: "UTC",
                            }).format(result.date)}
                          </time>
                        )}
                      </li>
                    ))}
                  </ul>
                  {results[kind].length === 25 && <p>{t("limit")}</p>}
                </section>
              ),
          )}
        </>
      )}
    </div>
  );
}
