"use client";
import { useEffect } from "react";

export function ProfileViewFocus({ section }: { section: string }) {
  useEffect(() => {
    const container = document.getElementById("dashboard-scroll");
    if (container) container.scrollTop = 0;
    container
      ?.querySelector<HTMLElement>("[data-profile-page] h1")
      ?.focus({ preventScroll: true });
  }, [section]);
  return null;
}
