import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { CreateAuditRunInput, CreateEvalRunInput, RunJobRecord } from "@answerlens/contracts";
import { createAuditRun, createEvalRun, getRunJob, listConfigPresets } from "../lib/api";
import { formatStatus } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import styles from "./RunLauncher.module.css";

type LaunchMode = "audit" | "eval";

export function RunLauncher() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<LaunchMode>("audit");
  const [presetId, setPresetId] = useState("");
  const [site, setSite] = useState("");
  const [provider, setProvider] = useState<"openai" | "perplexity">("openai");
  const [model, setModel] = useState("");
  const [samples, setSamples] = useState(1);
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

  const createRunMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPreset) {
        throw new Error("Select a preset before launching a run.");
      }

      if (mode === "audit") {
        const payload: CreateAuditRunInput = { presetId: selectedPreset.id, site };
        return createAuditRun(payload);
      }

      const payload: CreateEvalRunInput = {
        presetId: selectedPreset.id,
        site,
        provider,
        model: model.trim().length > 0 ? model.trim() : undefined,
        samples
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
        Launch run
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
                <p className={styles.eyebrow}>Run launcher</p>
                <h2 className={styles.title} id="run-launcher-title">
                  Start an AnswerLens run
                </h2>
                <p className={styles.summary}>
                  Choose a repo preset, set the target site, and let the BFF write a fresh file-backed run into
                  `runs/*`.
                </p>
              </div>
              <button className={styles.close} type="button" aria-label="Close run launcher" onClick={() => setOpen(false)}>
                ×
              </button>
            </header>

            <div className={styles.body}>
              <div className={styles.modeRow}>
                <button
                  type="button"
                  className={`${styles.modeButton} ${mode === "audit" ? styles.modeButtonActive : ""}`}
                  onClick={() => setMode("audit")}
                >
                  Audit
                </button>
                <button
                  type="button"
                  className={`${styles.modeButton} ${mode === "eval" ? styles.modeButtonActive : ""}`}
                  onClick={() => setMode("eval")}
                >
                  Eval
                </button>
              </div>

              <div className={styles.grid}>
                <label className={styles.field}>
                  <span className={styles.label}>Preset</span>
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
                  <span className={styles.label}>Site input</span>
                  <input
                    className={styles.input}
                    value={site}
                    onChange={(event) => setSite(event.target.value)}
                    placeholder="https://example.com or ./examples/fixtures/static-good"
                  />
                </label>

                {mode === "eval" ? (
                  <>
                    <label className={styles.field}>
                      <span className={styles.label}>Provider</span>
                      <select
                        className={styles.select}
                        value={provider}
                        onChange={(event) => setProvider(event.target.value as "openai" | "perplexity")}
                      >
                        <option value="openai">OpenAI</option>
                        <option value="perplexity">Perplexity</option>
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Samples</span>
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
                      <span className={styles.label}>Model override</span>
                      <input
                        className={styles.input}
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        placeholder="Optional, defaults to the provider's standard model"
                      />
                    </label>
                  </>
                ) : null}
              </div>

              {selectedPreset ? (
                <p className={styles.hint}>
                  Default target: <strong>{selectedPreset.defaultSiteInput}</strong>. Files: {selectedPreset.brandPath},{" "}
                  {selectedPreset.competitorsPath}, {selectedPreset.promptsPath}.
                </p>
              ) : null}

              <footer className={styles.footer}>
                <div className={styles.status}>
                  {job ? <StatusBadge label={formatStatus(job.status)} tone={job.status === "failed" ? "error" : "info"} /> : null}
                  {job?.error ? <span className={styles.hint}>{job.error}</span> : null}
                  {presetsQuery.isLoading ? <span className={styles.hint}>Loading presets…</span> : null}
                </div>
                <button
                  className={styles.submit}
                  type="button"
                  disabled={createRunMutation.isPending || presets.length === 0 || site.trim().length === 0}
                  onClick={() => createRunMutation.mutate()}
                >
                  {createRunMutation.isPending || job ? "Launching…" : `Start ${mode}`}
                </button>
              </footer>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
