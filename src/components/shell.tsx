"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Icon } from "./icon";

const AccountContext = createContext<() => void>(() => undefined);
export const useAccountDialog = () => useContext(AccountContext);

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const watch = pathname.startsWith("/watch");
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const [overlay, setOverlay] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

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
    if (watch || window.innerWidth < 1312) setOverlay((value) => !value);
    else setExpanded((value) => !(value ?? true));
  }

  const openAccount = () => dialog.current?.showModal();
  return (
    <AccountContext.Provider value={openAccount}>
      <div
        className={`site-shell ${watch ? "watch-shell" : ""} sidebar-${expanded === null ? "auto" : expanded ? "expanded" : "collapsed"} ${overlay ? "sidebar-overlay-open" : ""}`}
      >
        <header
          className={`masthead ${searchOpen ? "mobile-search-open" : ""}`}
        >
          <div className="header-start">
            <button
              ref={menuButton}
              className="icon-button"
              aria-label="切换侧栏"
              onClick={toggleSidebar}
              aria-expanded={overlay || (expanded ?? undefined)}
            >
              <Icon name="menu" />
            </button>
            <Link
              className="brand"
              href="/"
              aria-label="bnds life · 十一小日子 首页"
            >
              <span className="brand-mark" aria-hidden="true">
                11
              </span>
              <span>bnds life</span>
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
            <button className="sign-in" onClick={openAccount}>
              <Icon name="user" />
              <span>登录</span>
            </button>
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
              <Icon name="home" />
              <span>首页</span>
            </Link>
            <Link
              href="/recommend"
              aria-current={pathname === "/recommend" ? "page" : undefined}
              onClick={() => setOverlay(false)}
            >
              <Icon name="recommend" />
              <span>推荐</span>
            </Link>
          </nav>
        </aside>
        <main id="main-content" className="page-content" inert={overlay}>
          {children}
        </main>
        <dialog
          ref={dialog}
          className="account-dialog"
          aria-labelledby="account-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) dialog.current?.close();
          }}
        >
          <div className="dialog-heading">
            <h2 id="account-title">登录 bnds life</h2>
            <button
              className="icon-button"
              aria-label="关闭登录窗口"
              onClick={() => dialog.current?.close()}
            >
              <Icon name="close" />
            </button>
          </div>
          <p>账户功能尚未开放。</p>
          <p>你可以直接浏览首页、观看视频和使用推荐。</p>
          <button
            className="primary-button"
            onClick={() => dialog.current?.close()}
          >
            继续观看
          </button>
        </dialog>
      </div>
    </AccountContext.Provider>
  );
}
