import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { EVAL_PROFILE_PRESETS, type CreateAuditRunInput, type CreateEvalRunInput, type EvalProfileName, type RunJobRecord } from "@answerlens/contracts";
import { createAuditRun, createEvalRun, getRunJob, listConfigPresets } from "../lib/api";
import { formatStatus } from "../lib/format";
import { useLocale } from "../lib/locale";
import { StatusBadge } from "./StatusBadge";
import styles from "./RunLauncher.module.css";

type LaunchMode = "audit" | "eval";

function presetUse(presetId: string, t: (key: string) => string): string {
  if (presetId === "example-acme") {
    return t("admin.launcher.use.fixture");
  }
  if (presetId === "repo-answerlens") {
    return t("admin.launcher.use.repo");
  }
  return t("admin.launcher.use.starter");
}

function presetNextMove(presetId: string, t: (key: string) => string): string {
  if (presetId === "example-acme") {
    return t("admin.launcher.next.fixture");
  }
  if (presetId === "repo-answerlens") {
    return t("admin.launcher.next.repo");
  }
  return t("admin.launcher.next.starter");
}

export function RunLauncher() {
  const { locale: uiLocale, t } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<LaunchMode>("audit");
  const [presetId, setPresetId] = useState("");
  const [site, setSite] = useState("");
  const [provider, setProvider] = useState<"" | "openai" | "perplexity">("");
  const [profile, setProfile] = useState<"" | EvalProfileName>("");
  const [model, setModel] = useState("");
  const [samples, setSamples] = useState(1);
  const [localeOverride, setLocaleOverride] = useState("");
  const [timeoutMs, setTimeoutMs] = useState(60000);
  const [baseUrl, setBaseUrl] = useState("");
  const [job, setJob] = useState<RunJobRecord | null>(null);

  const presetsQuery = useQuery({
    queryKey: ["config-presets"],
    queryFn: listConfigPresets
  });

  const presets = presetsQuery.data?.presets ?? [];
  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === presetId) ?? presets[0] ?? null,
    [presetId, presets]
  );

  useEffect(() => {
    if (!selectedPreset && presets[0]) {
      setPresetId(presets[0].id);
      setSite(presets[0].defaultSiteInput);
      return;
    }
    if (selectedPreset && site.trim().length === 0) {
      setSite(selectedPreset.defaultSiteInput);
    }
  }, [selectedPreset, presets, site]);

  useEffect(() => {
    if (!selectedPreset) {
      return;
    }

    setProvider(selectedPreset.runtimeDefaults?.provider ?? "");
    setProfile("");
    setModel(selectedPreset.runtimeDefaults?.model ?? "");
    setSamples(selectedPreset.runtimeDefaults?.samples ?? 1);
    setLocaleOverride(selectedPreset.runtimeDefaults?.locale ?? "");
    setTimeoutMs(selectedPreset.runtimeDefaults?.timeoutMs ?? 60000);
    setBaseUrl(selectedPreset.runtimeDefaults?.baseUrl ?? "");
  }, [selectedPreset?.id]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const next = EVAL_PROFILE_PRESETS[profile].defaults;
    setProvider(next.provider);
    setModel(next.model);
    setSamples(next.samples);
    setLocaleOverride(next.locale ?? "");
    setTimeoutMs(next.timeoutMs);
  }, [profile]);

  const createRunMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPreset) {
        throw new Error(t("admin.launcher.selectPresetError"));
      }

      if (mode === "audit") {
        const payload: CreateAuditRunInput = { presetId: selectedPreset.id, site };
        return createAuditRun(payload);
      }

      const payload: CreateEvalRunInput = {
        presetId: selectedPreset.id,
        site,
        runtimePath: selectedPreset.runtimePath,
        profile: profile || undefined,
        provider:
          provider !== "" && provider !== selectedPreset.runtimeDefaults?.provider ? provider : undefined,
        model:
          model.trim().length > 0 && model.trim() !== selectedPreset.runtimeDefaults?.model
            ? model.trim()
            : undefined,
        samples: samples !== selectedPreset.runtimeDefaults?.samples ? samples : undefined,
        locale:
          localeOverride.trim().length > 0 && localeOverride.trim() !== (selectedPreset.runtimeDefaults?.locale ?? "")
            ? localeOverride.trim()
            : undefined,
        timeoutMs: timeoutMs !== selectedPreset.runtimeDefaults?.timeoutMs ? timeoutMs : undefined,
        baseUrl:
          baseUrl.trim().length > 0 && baseUrl.trim() !== selectedPreset.runtimeDefaults?.baseUrl
            ? baseUrl.trim()
            : undefined
      };
      return createEvalRun(payload);
    },
    onSuccess: (createdJob) => {
      setJob(createdJob);
    }
  });

  const jobQuery = useQuery({
    queryKey: ["job", job?.id],
    queryFn: () => getRunJob(job!.id),
    enabled: Boolean(job?.id),
    refetchInterval: (query) => {
      const current = query.state.data;
      return current && (current.status === "completed" || current.status === "failed") ? false : 1000;
    }
  });

  useEffect(() => {
    const current = jobQuery.data;
    if (!current) {
      return;
    }
    setJob(current);

    if (current.status === "completed" && current.runId) {
      void queryClient.invalidateQueries({ queryKey: ["runs"] });
      setOpen(false);
      navigate(`/runs/${current.runId}`);
      setJob(null);
    }
  }, [jobQuery.data, navigate, queryClient]);

  return (
    <>
      <button className={styles.trigger} type="button" onClick={() => setOpen(true)}>
        {t("admin.launch")}
      </button>

      {open ? (
        <div className={styles.overlay} role="presentation" onClick={() => setOpen(false)}>
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="run-launcher-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.header}>
              <div>
                <p className={styles.eyebrow}>{t("admin.launcher.eyebrow")}</p>
                <h2 className={styles.title} id="run-launcher-title">
                  {t("admin.launcher.title")}
                </h2>
                <p className={styles.summary}>{t("admin.launcher.summary")}</p>
              </div>
              <button className={styles.close} type="button" aria-label={t("admin.launcher.close")} onClick={() => setOpen(false)}>
                X
              </button>
            </header>

            <div className={styles.body}>
              <div className={styles.modeRow}>
                <button
                  type="button"
                  className={`${styles.modeButton} ${mode === "audit" ? styles.modeButtonActive : ""}`}
                  onClick={() => setMode("audit")}
                >
                  {t("admin.launcher.mode.audit")}
                </button>
                <button
                  type="button"
                  className={`${styles.modeButton} ${mode === "eval" ? styles.modeButtonActive : ""}`}
                  onClick={() => setMode("eval")}
                >
                  {t("admin.launcher.mode.eval")}
                </button>
              </div>

              <div className={styles.grid}>
                <label className={styles.field}>
                  <span className={styles.label}>{t("admin.launcher.preset")}</span>
                  <select
                    className={styles.select}
                    value={selectedPreset?.id ?? ""}
                    onChange={(event) => {
                      const nextPreset = presets.find((preset) => preset.id === event.target.value);
                      setPresetId(event.target.value);
                      if (nextPreset) {
                        setSite(nextPreset.defaultSiteInput);
                      }
                    }}
                  >
                    {presets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span className={styles.label}>{t("admin.launcher.site")}</span>
                  <input
                    className={styles.input}
                    value={site}
                    onChange={(event) => setSite(event.target.value)}
                    placeholder={t("admin.launcher.site.placeholder")}
                  />
                </label>

                {mode === "eval" ? (
                  <>
                    <label className={styles.field}>
                      <span className={styles.label}>{t("admin.launcher.profile")}</span>
                      <select
                        className={styles.select}
                        value={profile}
                        onChange={(event) => setProfile(event.target.value as "" | EvalProfileName)}
                      >
                        <option value="">{t("admin.launcher.profile.default")}</option>
                        {Object.values(EVAL_PROFILE_PRESETS).map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>{t("admin.launcher.provider")}</span>
                      <select
                        className={styles.select}
                        value={provider}
                        onChange={(event) => setProvider(event.target.value as "" | "openai" | "perplexity")}
                      >
                        <option value="">{t("common.pending")}</option>
                        <option value="openai">OpenAI</option>
                        <option value="perplexity">Perplexity</option>
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>{t("admin.launcher.samples")}</span>
                      <input
                        className={styles.input}
                        type="number"
                        min={1}
                        max={5}
                        value={samples}
                        onChange={(event) => setSamples(Number(event.target.value) || 1)}
                      />
                    </label>

                    <label className={`${styles.field} ${styles.fieldWide}`}>
                      <span className={styles.label}>{t("admin.launcher.model")}</span>
                      <input
                        className={styles.input}
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        placeholder={t("admin.launcher.model.placeholder")}
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>{t("admin.launcher.locale")}</span>
                      <input
                        className={styles.input}
                        value={localeOverride}
                        onChange={(event) => setLocaleOverride(event.target.value)}
                        placeholder="zh-CN"
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>{t("admin.launcher.timeout")}</span>
                      <input
                        className={styles.input}
                        type="number"
                        min={1000}
                        step={1000}
                        value={timeoutMs}
                        onChange={(event) => setTimeoutMs(Number(event.target.value) || 60000)}
                      />
                    </label>

                    <label className={`${styles.field} ${styles.fieldWide}`}>
                      <span className={styles.label}>{t("admin.launcher.baseUrl")}</span>
                      <input
                        className={styles.input}
                        value={baseUrl}
                        onChange={(event) => setBaseUrl(event.target.value)}
                        placeholder={t("admin.launcher.baseUrl.placeholder")}
                      />
                    </label>
                  </>
                ) : null}
              </div>

              {selectedPreset ? (
                <div className={styles.hintStack}>
                  <p className={styles.hint}>
                    {t("admin.launcher.defaultTarget")}: <strong>{selectedPreset.defaultSiteInput}</strong>. {t("admin.launcher.files")}: {selectedPreset.brandPath},{" "}
                    {selectedPreset.competitorsPath}, {selectedPreset.promptsPath}.
                  </p>
                  <p className={styles.hint}>
                    {t("admin.launcher.presetGuide")}: <strong>{presetUse(selectedPreset.id, t)}</strong>
                  </p>
                  {profile ? (
                    <p className={styles.hint}>
                      {t("admin.launcher.profile")}:{" "}
                      <strong>{EVAL_PROFILE_PRESETS[profile].label}</strong>.{" "}
                      {EVAL_PROFILE_PRESETS[profile].description}
                    </p>
                  ) : null}
                  {selectedPreset.runtimeDefaults ? (
                    <p className={styles.hint}>
                      {t("admin.launcher.runtime")}: <strong>{selectedPreset.runtimePath}</strong>.{" "}
                      {t("admin.launcher.runtimeDefaults")}:{" "}
                      <strong>
                        {selectedPreset.runtimeDefaults.provider} · {selectedPreset.runtimeDefaults.model} ·{" "}
                        {selectedPreset.runtimeDefaults.locale ?? t("common.pending")} ·{" "}
                        {selectedPreset.runtimeDefaults.samples}
                      </strong>
                    </p>
                  ) : null}
                  {selectedPreset.runtimeDefaults ? (
                    <p className={styles.hint}>
                      {t("admin.launcher.runtimeNetwork")}:{" "}
                      <strong>
                        {selectedPreset.runtimeDefaults.timeoutMs}ms · {selectedPreset.runtimeDefaults.baseUrl}
                      </strong>
                    </p>
                  ) : null}
                  <p className={styles.hint}>
                    {t("admin.launcher.nextMove")}: <strong>{presetNextMove(selectedPreset.id, t)}</strong>
                  </p>
                </div>
              ) : null}

              <footer className={styles.footer}>
                <div className={styles.status}>
                  {job ? <StatusBadge label={formatStatus(job.status, uiLocale)} tone={job.status === "failed" ? "error" : "info"} /> : null}
                  {job?.error ? <span className={styles.hint}>{job.error}</span> : null}
                  {presetsQuery.isLoading ? <span className={styles.hint}>{t("admin.launcher.loadingPresets")}</span> : null}
                </div>
                <button
                  className={styles.submit}
                  type="button"
                  disabled={createRunMutation.isPending || presets.length === 0 || site.trim().length === 0}
                  onClick={() => createRunMutation.mutate()}
                >
                  {createRunMutation.isPending || job ? t("admin.launcher.launching") : t("admin.launcher.start", { mode: mode === "audit" ? t("admin.launcher.mode.audit") : t("admin.launcher.mode.eval") })}
                </button>
              </footer>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
