"use client";
import { useEffect } from "react";
import { useRouter } from "@/i18n/routing";

/** Ctrl+K / Cmd+K opens the dashboard search from anywhere in the dashboard. */
export function SearchShortcut() {
  const router = useRouter();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/dashboard/search");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}
