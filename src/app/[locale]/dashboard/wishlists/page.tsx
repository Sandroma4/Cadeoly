import { ListBrowser } from "@/components/wishlist/ListBrowser";
import { OptionsMenu } from "@/components/dashboard/OptionsMenu";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import { WishlistHelp } from "@/components/wishlist/WishlistHelp";
import styles from "./page.module.css";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
import { Link } from "@/i18n/routing";
import { getMyWishlists } from "@/app/actions/wishlist";
import { getTranslations } from "next-intl/server";
import { ListLifecycle } from "@/components/wishlist/ListLifecycle";

export default async function WishlistsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const requested = (await searchParams).view;
  const view =
    requested === "archived" || requested === "trash" ? requested : "active";
  const [wishlists, lifecycle, t, tw] = await Promise.all([
    getMyWishlists(view),
    getTranslations("listLifecycle"),
    getTranslations("dashboard"),
    getTranslations("wishlist"),
  ]);

  const nav = await getTranslations("listNavigation");
  return (
    <div className={`${styles.container} wishlist-page`}>
      <header className={styles.header}>
        <div>
          <h1>{t("myWishlists")}</h1>
          <p className="page-intro">{tw("intro")}</p>
        </div>
        {(wishlists.length > 0 || view !== "active") && (
          <Link
            className={`primary-link ${styles.newWishlist}`}
            href="/dashboard/wishlists/create"
            aria-label={t("newWishlist")}
          >
            <span className={styles.newWishlistLabel}>{t("newWishlist")}</span>
          </Link>
        )}
      </header>

      {wishlists.length === 0 && (
        <nav
          className="button-row segmented-filters"
          aria-label={lifecycle("views")}
        >
          {(["active", "archived", "trash"] as const).map((state) => (
            <Link
              key={state}
              aria-current={view === state ? "page" : undefined}
              href={`/dashboard/wishlists?view=${state}`}
            >
              {lifecycle(state + "Tab")}
            </Link>
          ))}
        </nav>
      )}
      {view !== "active" && (
        <p>{lifecycle(view === "trash" ? "trashHelp" : "archiveHelp")}</p>
      )}
      {wishlists.length === 0 ? (
        <Card className={styles.emptyCard}>
          <CardContent className={styles.emptyContent}>
            <div className="empty-art">
              <OccasionIcon kind="gift" />
            </div>
            <p>
              {view === "active"
                ? tw("empty")
                : nav(view === "trash" ? "emptyTrash" : "emptyArchive")}
            </p>
            <Link
              className="primary-link"
              href={
                view === "active"
                  ? "/dashboard/wishlists/create"
                  : "/dashboard/wishlists"
              }
            >
              <span>
                {view === "active" ? tw("createFirst") : lifecycle("activeTab")}
              </span>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ListBrowser
          filters={
            <nav
              className="button-row segmented-filters"
              aria-label={lifecycle("views")}
            >
              {(["active", "archived", "trash"] as const).map((state) => (
                <Link
                  key={state}
                  aria-current={view === state ? "page" : undefined}
                  href={`/dashboard/wishlists?view=${state}`}
                >
                  {lifecycle(state + "Tab")}
                </Link>
              ))}
            </nav>
          }
          lists={wishlists.map((list) => ({
            id: list.id,
            name: list.name,
            description: list.description,
            card: (
              <Card key={list.id} className={styles.wishlistCard}>
                <OptionsMenu
                  className={styles.cardMenu}
                  label={`${nav("manage")} : ${list.name}`}
                  more
                >
                  <div className={styles.menuPanel}>
                    <ListLifecycle id={list.id} name={list.name} state={view} />
                  </div>
                </OptionsMenu>
                <CardHeader>
                  <CardTitle>
                    {view === "trash" ? (
                      list.name
                    ) : (
                      <Link
                        href={`/dashboard/wishlists/${list.id}?from=${view}`}
                        prefetch={true}
                      >
                        {list.name}
                      </Link>
                    )}
                  </CardTitle>
                  <CardDescription className="list-meta">
                    <span className="visual-badge">
                      {tw(
                        `visibility${list.visibility.charAt(0) + list.visibility.slice(1).toLowerCase()}`,
                      )}
                    </span>{" "}
                    <span className={styles.itemCount}>
                      • {tw("itemsCount", { count: list._count.items })}
                    </span>
                  </CardDescription>
                </CardHeader>
                {list.description?.trim() && (
                  <CardContent>
                    <p className={styles.description}>{list.description}</p>
                  </CardContent>
                )}
                {view !== "trash" && (
                  <CardFooter className={styles.cardFooter}>
                    <Link
                      href={`/dashboard/wishlists/${list.id}?from=${view}`}
                      className="primary-link"
                    >
                      {tw("viewList")}
                    </Link>
                  </CardFooter>
                )}
              </Card>
            ),
          }))}
        />
      )}
      <WishlistHelp open={view === "active" && wishlists.length === 0} />
    </div>
  );
}
