import { NavLink, Outlet } from "react-router-dom";
import { RunLauncher } from "../components/RunLauncher";
import styles from "./AppShell.module.css";

const navItems = [
  { to: "/runs", label: "Runs" },
  { to: "/presets", label: "Presets" }
];

export function AppShell() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandLabel}>Internal control console</span>
          <h1 className={styles.brandTitle}>AnswerLens Admin</h1>
          <p className={styles.brandSummary}>
            Orchestrate audits, inspect artifact trails, and keep the repo-native workflow visible without turning
            AnswerLens into a dashboard-first product.
          </p>
        </div>

        <nav className={styles.nav} aria-label="Admin navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <section className={styles.sidebarCard}>
          <p className={styles.sidebarEyebrow}>V1 scope</p>
          <ul className={styles.sidebarList}>
            <li>Runs as the primary workspace</li>
            <li>Artifact-first review order</li>
            <li>Thin BFF over repo presets and local runs</li>
          </ul>
        </section>

        <section className={styles.sidebarCard}>
          <p className={styles.sidebarEyebrow}>Review order</p>
          <ul className={styles.sidebarList}>
            <li>Open `share-summary.md` first</li>
            <li>Then inspect `scorecard.md`</li>
            <li>Use `recommendations.md` for the fix path</li>
          </ul>
        </section>
      </aside>

      <div className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.topbarText}>
            <p className={styles.topbarTitle}>CI for AI discoverability</p>
            <p className={styles.topbarSummary}>
              Vaporwave shell, calm data plane: internal orchestration for repo presets, file-backed runs, and report
              review.
            </p>
          </div>
          <RunLauncher />
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
