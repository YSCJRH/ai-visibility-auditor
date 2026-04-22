import { NavLink, Outlet, useMatch } from "react-router-dom";
import type { Locale } from "../shared/i18n.ts";
import { RunLauncher } from "../components/RunLauncher";
import { useLocale } from "../lib/locale";
import styles from "./AppShell.module.css";

const navItems = [
  { to: "/runs", labelKey: "admin.nav.runs" },
  { to: "/presets", labelKey: "admin.nav.presets" }
];

const localeOptions: Array<{ locale: Locale; labelKey: string }> = [
  { locale: "en", labelKey: "lang.english" },
  { locale: "zh-CN", labelKey: "lang.chinese" }
];

export function AppShell() {
  const { locale, setLocale, t } = useLocale();
  const runDetailMatch = useMatch("/runs/:runId");
  const presetsMatch = useMatch("/presets");

  const topbarContext = runDetailMatch
    ? {
        title: t("admin.topbar.runDetailTitle"),
        summary: t("admin.topbar.runDetailSummary")
      }
    : presetsMatch
      ? {
          title: t("admin.topbar.presetsTitle"),
          summary: t("admin.topbar.presetsSummary")
        }
      : {
          title: t("admin.topbar.runsTitle"),
          summary: t("admin.topbar.runsSummary")
        };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandLabel}>{t("admin.brandLabel")}</span>
          <h1 className={styles.brandTitle}>AnswerLens Admin</h1>
          <p className={styles.brandSummary}>{t("admin.brandSummary")}</p>
        </div>

        <nav className={styles.nav} aria-label="Admin navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        <section className={styles.sidebarCard}>
          <p className={styles.sidebarEyebrow}>{t("admin.sidebar.path.title")}</p>
          <p className={styles.sidebarBody}>{t("admin.sidebar.path.body")}</p>
          <ul className={styles.sidebarList}>
            <li>{t("admin.sidebar.path.item1")}</li>
            <li>{t("admin.sidebar.path.item2")}</li>
            <li>{t("admin.sidebar.path.item3")}</li>
          </ul>
        </section>

        <section className={styles.sidebarCard}>
          <p className={styles.sidebarEyebrow}>{t("admin.sidebar.artifacts.title")}</p>
          <p className={styles.sidebarBody}>{t("admin.sidebar.artifacts.body")}</p>
          <ul className={styles.sidebarList}>
            <li>{t("admin.sidebar.artifacts.item1")}</li>
            <li>{t("admin.sidebar.artifacts.item2")}</li>
            <li>{t("admin.sidebar.artifacts.item3")}</li>
          </ul>
        </section>
      </aside>

      <div className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.topbarText}>
            <p className={styles.topbarTitle}>{topbarContext.title}</p>
            <p className={styles.topbarSummary}>{topbarContext.summary}</p>
          </div>
          <div className={styles.topbarActions}>
            <label className={styles.localePicker}>
              <span className={styles.localeLabel}>{t("lang.label")}</span>
              <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} className={styles.localeSelect}>
                {localeOptions.map((option) => (
                  <option key={option.locale} value={option.locale}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <RunLauncher />
          </div>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
