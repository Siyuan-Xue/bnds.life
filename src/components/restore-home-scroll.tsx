"use client";

import { useEffect } from "react";

export function RestoreHomeScroll() {
  useEffect(() => {
    const root = document.querySelector(".home-page");
    const rememberPosition = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('a[href*="from=home"]')) {
        sessionStorage.setItem("bnds:home-scroll", String(window.scrollY));
        sessionStorage.setItem(
          "bnds:home-order",
          new URLSearchParams(window.location.search).get("order") === "asc"
            ? "asc"
            : "desc",
        );
      }
    };
    root?.addEventListener("click", rememberPosition);
    const saved = sessionStorage.getItem("bnds:restore-home-scroll");
    if (saved === null)
      return () => root?.removeEventListener("click", rememberPosition);
    sessionStorage.removeItem("bnds:restore-home-scroll");
    const top = Number(saved);
    if (Number.isFinite(top) && top >= 0)
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          window.scrollTo({ top, behavior: "instant" }),
        ),
      );
    return () => root?.removeEventListener("click", rememberPosition);
  }, []);
  return null;
}
