export function returnPath(value: unknown, locale: string) {
  if (
    typeof value === "string" &&
    value.length <= 5000 &&
    /^\/(fr|en)\//.test(value) &&
    !/[\\\u0000-\u0020\u007f]/.test(value)
  ) {
    try {
      const parsed = new URL(value, "https://local.invalid");
      const rawPath = value.split(/[?#]/, 1)[0];
      const path = parsed.pathname.replace(/^\/(fr|en)/, "");
      let keys: string[] | undefined;
      if (path === "/quick-add")
        keys = ["url", "title", "text", "price", "image"];
      else if (path === "/guest") keys = ["section"];
      else if (/^\/guest\/reservations\/[A-Za-z0-9_-]+$/.test(path)) keys = [];
      else if (/^\/(invite|share|lists)\/[A-Za-z0-9_-]+$/.test(path)) keys = [];
      else if (path === "/dashboard/wishlists") keys = ["view"];
      else if (path === "/dashboard/wishlists/create")
        keys = ["eventId", "url", "title", "text", "price", "image"];
      else if (/^\/dashboard\/wishlists\/[A-Za-z0-9_-]+$/.test(path))
        keys = [
          "from",
          "preview",
          "q",
          "maxPrice",
          "priority",
          "status",
          "sort",
          "page",
        ];
      else if (path === "/dashboard/events") keys = ["period"];
      else if (/^\/dashboard\/events\/[A-Za-z0-9_-]+$/.test(path)) keys = [];
      else if (
        /^\/dashboard(?:\/(profile|family|reservations|gift-ideas|feedback))?$/.test(
          path,
        )
      )
        keys = [];
      if (
        parsed.origin === "https://local.invalid" &&
        parsed.pathname === rawPath &&
        keys &&
        !parsed.hash &&
        [...parsed.searchParams.keys()].every((key) => keys.includes(key))
      )
        return parsed.pathname + parsed.search;
    } catch {}
  }
  return "/" + locale + "/dashboard";
}
