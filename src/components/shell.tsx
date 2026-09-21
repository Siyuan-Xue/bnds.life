"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { BrandLogo } from "./brand-logo";
import { AccountMenu } from "./account-menu";
import { MOBILE_LAYOUT_QUERY } from "~/lib/video-layout";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const watch = pathname.startsWith("/watch");
  const [overlay, setOverlay] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const sync = () => {
      setOverlay(false);
      setSearchOpen(false);
    };
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    setOverlay(false);
    setSearchOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        setOverlay(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);
  useEffect(() => {
    if (!overlay) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [overlay]);

  function toggleSidebar() {
    setOverlay((value) => !value);
  }

  return (
    <div
      className={`site-shell ${watch ? "watch-shell" : ""} sidebar-collapsed ${overlay ? "sidebar-overlay-open" : ""}`}
    >
      <header className={`masthead ${searchOpen ? "mobile-search-open" : ""}`}>
        <div className="header-start">
          <button
            ref={menuButton}
            className="icon-button sidebar-toggle"
            aria-label="切换侧栏"
            onClick={toggleSidebar}
            aria-expanded={overlay}
          >
            <Icon name="menu" />
          </button>
          <Link
            className="brand"
            href="/"
            aria-label="BNDS.life · 十一小日子 首页"
          >
            <BrandLogo />
            <span>BNDS.life</span>
          </Link>
        </div>
        <form action="/" className="search-form" role="search">
          <button
            className="icon-button search-back"
            type="button"
            aria-label="关闭搜索"
            onClick={() => setSearchOpen(false)}
          >
            <Icon name="back" />
          </button>
          <input
            ref={searchInput}
            type="search"
            name="q"
            aria-label="搜索视频"
            placeholder="搜索"
            maxLength={200}
          />
          <button className="search-submit" aria-label="搜索" type="submit">
            <Icon name="search" />
          </button>
        </form>
        <div className="header-end">
          <button
            className="icon-button mobile-search-button"
            aria-label="打开搜索"
            onClick={() => {
              setSearchOpen(true);
              requestAnimationFrame(() => searchInput.current?.focus());
            }}
          >
            <Icon name="search" />
          </button>
          <AccountMenu />
        </div>
      </header>
      {overlay && (
        <button
          tabIndex={-1}
          className="sidebar-backdrop"
          aria-label="关闭侧栏"
          onClick={() => {
            setOverlay(false);
            menuButton.current?.focus();
          }}
        />
      )}
      <aside className="sidebar">
        <nav aria-label="主导航">
          <Link
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
            onClick={() => setOverlay(false)}
          >
            <Icon name="home" selected={pathname === "/"} />
            <span>首页</span>
          </Link>
          <Link
            href="/recommend"
            aria-current={pathname === "/recommend" ? "page" : undefined}
            onClick={() => setOverlay(false)}
          >
            <Icon name="recommend" selected={pathname === "/recommend"} />
            <span>推荐</span>
          </Link>
        </nav>
      </aside>
      <main id="main-content" className="page-content" inert={overlay}>
        {children}
      </main>
    </div>
  );
}
