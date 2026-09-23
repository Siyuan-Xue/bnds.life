"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icon";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(
      document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    );
  }, []);

  function toggle() {
    const next: Theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem("bnds:theme", next);
    } catch {
      // The chosen theme still applies for this page when storage is disabled.
    }
  }

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? "切换为浅色模式" : "切换为深色模式"}
      title={theme === "dark" ? "浅色模式" : "深色模式"}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}
