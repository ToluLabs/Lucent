"use client";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { Button } from "@/components/ui/Button";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { ProofLoadingOverlay } from "@/components/ui/ProofLoadingOverlay";
import { displayAmount, formatAmount, toBaseUnits } from "@/lib/amount";
import { DEPLOYMENT } from "@/lib/deployment";
import { errMsg } from "@/lib/err";
import { useAction } from "@/lib/use-action";
import { useWallet } from "@/lib/wallet-context";
import { RunStatus } from "@lucent/sdk";
import { StrKey } from "@stellar/stellar-sdk";
import { Briefcase, Plus, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
type Template = { id: bigint; employees: string[]; active: boolean };
type Run = { id: bigint; templateId: bigint; status: RunStatus };
const statuses: Record<RunStatus, string> = {
  [RunStatus.Scheduled]: "Draft",
  [RunStatus.Funded]: "Ready to pay",
  [RunStatus.Executed]: "Paid",
  [RunStatus.Cancelled]: "Cancelled",
};
export default function PayrollPage() {
  const { wallet, view, error, setError } = useWallet();
  const { run, busy, phase, uncertain } = useAction();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [mode, setMode] = useState<"employer" | "incoming">("employer");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [addresses, setAddresses] = useState([""]);
  const [executing, setExecuting] = useState<Run | null>(null);
  const [salaries, setSalaries] = useState<Record<string, string>>({});
  const [review, setReview] = useState(false);
  const [cancel, setCancel] = useState<Run | null>(null);
  const configured = !!DEPLOYMENT.contracts.payroll;
  const ready = !!view?.registered && view.matchesChain;
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    if (!wallet || !configured) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setTemplates([]);
    setRuns([]);
    (async () => {
      try {
        const tpls: Template[] = [];
        const count = await wallet.payrollTemplateCount();
        for (let i = 1n; i <= count; i++) {
          const t = await wallet.payrollTemplate(i);
          if (t.employer === wallet.address)
            tpls.push({ id: i, employees: t.employees, active: t.active });
        }
        const results: Run[] = [];
        const runCount = await wallet.payrollRunCount();
        for (let i = 1n; i <= runCount; i++) {
          const r = await wallet.payrollRun(i);
          if (tpls.some((t) => t.id === r.templateId))
            results.push({ id: i, templateId: r.templateId, status: r.status });
        }
        if (!cancelled) {
          setTemplates(tpls);
          setRuns(results);
        }
      } catch (e) {
        if (!cancelled) setLoadError(errMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet, configured, attempt]);
  useEffect(() => {
    setSelectedId(null);
    setCreateOpen(false);
    setExecuting(null);
    setAddresses([""]);
    setSalaries({});
  }, [wallet]);
  const selected = templates.find((t) => t.id === selectedId);
  const employees =
    templates.find((t) => t.id === executing?.templateId)?.employees ?? [];
  const total = employees.reduce(
    (sum, a) => sum + toBaseUnits(salaries[a] || "0"),
    0n,
  );
  const available = view?.spendable ?? 0n;
  const allPositive =
    employees.length > 0 &&
    employees.every((a) => toBaseUnits(salaries[a] || "0") > 0n);
  const valid = allPositive && total <= available;
  async function validateRecipients(values: string[]) {
    if (!values.length) throw new Error("Add at least one recipient.");
    if (new Set(values).size !== values.length)
      throw new Error("Each recipient must appear only once.");
    for (const address of values) {
      if (!StrKey.isValidEd25519PublicKey(address))
        throw new Error("Enter a valid Stellar G address for every recipient.");
      if (!(await wallet!.isRecipientRegistered(address)))
        throw new Error(
          `Recipient ${address.slice(0, 8)}… is not registered on Lucent Testnet.`,
        );
    }
  }
  async function createTemplate() {
    if (!ready) return;
    const values = addresses.map((a) => a.trim());
    const ok = await run(
      "template",
      async () => {
        await validateRecipients(values);
        await wallet!.createTemplate(values);
      },
      { refresh: false },
    );
    if (ok) {
      setCreateOpen(false);
      setAddresses([""]);
      reload();
    }
  }
  async function execute() {
    if (!executing || !ready || !valid) return;
    const ok = await run("execute", async (sp) => {
      await validateRecipients(employees);
      await wallet!.executeRun(
        executing.id,
        employees.map((employee) => ({
          employee,
          amount: toBaseUnits(salaries[employee]),
        })),
        sp,
      );
    });
    if (ok) {
      setExecuting(null);
      setReview(false);
      reload();
    }
  }
  if (!wallet)
    return (
      <AppShell>
        <PageHeader title="Payroll" />
        <ConnectPrompt message="Connect to prepare recipient templates and run confidential payroll." />
      </AppShell>
    );
  if (!configured)
    return (
      <AppShell>
        <PageHeader title="Payroll" />
        <div className="workspace-page">
          <GlassCard>
            <h2 className="font-semibold">
              Payroll unavailable in this deployment
            </h2>
            <p className="mt-3 text-sm text-text-secondary">
              The payroll contract is not configured for this environment.
            </p>
          </GlassCard>
        </div>
      </AppShell>
    );
  const visible = templates.filter((t) =>
    `${t.id} ${t.employees.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(visible.length / 10));
  const current = Math.min(page, pages);
  return (
    <AppShell>
      <PageHeader
        title={selected ? `Payroll · Template #${selected.id}` : "Payroll"}
        description={
          selected ? "Recipient roster and on-chain payment runs." : undefined
        }
        showBack={!!selected}
        onBack={() => setSelectedId(null)}
        right={
          <Button
            disabled={!ready || !!busy || uncertain}
            onClick={() => {
              setError(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New template
          </Button>
        }
      />
      <div className="workspace-page space-y-6">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        {!ready && (
          <p className="rounded-lg border border-warning/30 p-4 text-sm text-warning">
            Register and synchronize your confidential account in{" "}
            <Link href="/home" className="underline">
              Overview
            </Link>{" "}
            before payroll actions.
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          <GlassCard>
            <p className="text-sm text-text-secondary">Available for payroll</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">
              {ready ? displayAmount(available, 7) : "Unavailable"}
            </p>
          </GlassCard>
          <GlassCard>
            <p className="text-sm text-text-secondary">
              Your recipient templates
            </p>
            <p className="mt-3 text-2xl font-semibold">
              {loading
                ? "Loading…"
                : loadError
                  ? "Unavailable"
                  : templates.length}
            </p>
          </GlassCard>
          <GlassCard>
            <p className="text-sm text-text-secondary">Settlement model</p>
            <p className="mt-3 font-semibold">One atomic payment run</p>
            <p className="mt-2 text-xs text-text-muted">
              All payments settle together.
            </p>
          </GlassCard>
        </div>
        {!selected && (
          <div className="flex gap-2 border-b border-border pb-4">
            <Button
              variant={mode === "employer" ? "primary" : "ghost"}
              aria-pressed={mode === "employer"}
              onClick={() => setMode("employer")}
            >
              Manage payroll
            </Button>
            <Button
              variant={mode === "incoming" ? "primary" : "ghost"}
              aria-pressed={mode === "incoming"}
              onClick={() => setMode("incoming")}
            >
              Incoming funds
            </Button>
          </div>
        )}
        {mode === "incoming" && !selected ? (
          <GlassCard padding="lg">
            <h2 className="text-lg font-semibold">
              Incoming funds requiring merge
            </h2>
            <p className="mt-3 text-2xl tabular-nums">
              {ready ? displayAmount(view.receiving, 7) : "Unavailable"}
            </p>
            <p className="my-5 max-w-2xl text-sm leading-7 text-text-secondary">
              This balance can include payroll, deposits and other transfers.
              The token event feed does not establish which credits are salary.
              Merging makes incoming funds available to spend.
            </p>
            <Button
              disabled={!ready || view.receiving <= 0n || !!busy || uncertain}
              isLoading={busy === "claim"}
              onClick={() => run("claim", () => wallet.claimSalary())}
            >
              Merge incoming funds
            </Button>
          </GlassCard>
        ) : (
          <>
            {loadError ? (
              <GlassCard>
                <ErrorBanner
                  error={loadError}
                  onDismiss={() => setLoadError(null)}
                />
                <Button className="mt-4" onClick={reload}>
                  Retry loading payroll
                </Button>
              </GlassCard>
            ) : loading ? (
              <GlassCard>
                <p role="status">Loading payroll contracts…</p>
              </GlassCard>
            ) : selected ? (
              <div className="workspace-grid">
                <GlassCard padding="lg">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Payment runs</h2>
                    <Button
                      size="sm"
                      disabled={
                        !ready || !selected.active || !!busy || uncertain
                      }
                      onClick={async () => {
                        if (
                          await run(
                            "openrun",
                            () => wallet.createRun(selected.id).then(() => {}),
                            { refresh: false },
                          )
                        )
                          reload();
                      }}
                    >
                      Create draft run
                    </Button>
                  </div>
                  <p className="mb-5 text-sm leading-6 text-text-secondary">
                    Draft → confirm readiness → review salaries → execute.
                    Confirming readiness transfers no money and does not
                    schedule a date.
                  </p>
                  {runs.filter((r) => r.templateId === selected.id).length ===
                  0 ? (
                    <Empty
                      title="No runs yet"
                      detail="Create a draft to start preparing a payment batch."
                    />
                  ) : (
                    <div className="table-scroll">
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">
                          Payment runs for this template
                        </caption>
                        <thead className="text-xs text-text-muted">
                          <tr>
                            <th scope="col">Run</th>
                            <th scope="col">Status</th>
                            <th scope="col">Next action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runs
                            .filter((r) => r.templateId === selected.id)
                            .map((r) => (
                              <tr key={r.id.toString()}>
                                <td>#{r.id.toString()}</td>
                                <td>
                                  <Pill
                                    tone={
                                      r.status === RunStatus.Executed
                                        ? "green"
                                        : r.status === RunStatus.Cancelled
                                          ? "red"
                                          : "neutral"
                                    }
                                  >
                                    {statuses[r.status]}
                                  </Pill>
                                </td>
                                <td>
                                  <div className="flex flex-wrap gap-2">
                                    {r.status === RunStatus.Scheduled && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          disabled={
                                            !ready || !!busy || uncertain
                                          }
                                          onClick={async () => {
                                            if (
                                              await run(
                                                "fund",
                                                () => wallet.fundRun(r.id),
                                                { refresh: false },
                                              )
                                            )
                                              reload();
                                          }}
                                        >
                                          Confirm readiness
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          disabled={!!busy || uncertain}
                                          onClick={() => setCancel(r)}
                                        >
                                          Cancel
                                        </Button>
                                      </>
                                    )}
                                    {r.status === RunStatus.Funded && (
                                      <Button
                                        size="sm"
                                        disabled={!ready || !!busy || uncertain}
                                        onClick={() => {
                                          setExecuting(r);
                                          setSalaries({});
                                          setReview(false);
                                          setError(null);
                                        }}
                                      >
                                        Prepare payments
                                      </Button>
                                    )}
                                    {r.status === RunStatus.Executed && (
                                      <span className="text-xs text-success">
                                        All recipients paid
                                      </span>
                                    )}
                                    {r.status === RunStatus.Cancelled && (
                                      <span className="text-xs text-text-muted">
                                        No payment executed
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </GlassCard>
                <GlassCard padding="lg">
                  <h2 className="font-semibold">Template recipients</h2>
                  <p className="my-3 text-xs leading-6 text-text-muted">
                    On-chain addresses are public. Salaries are entered for each
                    run; no private employee directory is stored here.
                  </p>
                  <ol className="divide-y divide-border">
                    {selected.employees.map((a, i) => (
                      <li
                        key={`${a}-${i}`}
                        className="flex items-center justify-between gap-3 py-4"
                      >
                        <span className="text-xs text-text-muted">{i + 1}</span>
                        <AddressDisplay address={a} chars={6} />
                      </li>
                    ))}
                  </ol>
                </GlassCard>
              </div>
            ) : (
              <GlassCard padding="lg">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Recipient templates
                    </h2>
                    <p className="mt-2 text-sm text-text-secondary">
                      Reusable on-chain recipient lists. Amounts are set per
                      run.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={reload}>
                    Refresh
                  </Button>
                </div>
                <div className="my-5 max-w-md">
                  <Input
                    label="Find a template"
                    placeholder="Template ID or recipient address"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                {visible.length === 0 ? (
                  <Empty
                    title="No templates found"
                    detail="Create a recipient template, then prepare a payroll run."
                  />
                ) : (
                  <div className="table-scroll">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">
                        Your payroll templates
                      </caption>
                      <thead className="text-xs text-text-muted">
                        <tr>
                          <th scope="col">Template</th>
                          <th scope="col">Recipients</th>
                          <th scope="col">Status</th>
                          <th scope="col">Manage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible
                          .slice((current - 1) * 10, current * 10)
                          .map((t) => (
                            <tr key={t.id.toString()}>
                              <td className="font-medium">
                                Template #{t.id.toString()}
                              </td>
                              <td>{t.employees.length}</td>
                              <td>{t.active ? "Active" : "Inactive"}</td>
                              <td>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setSelectedId(t.id)}
                                >
                                  Open
                                </Button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
                  <span>
                    Page {current} of {pages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={current <= 1}
                      onClick={() => setPage(current - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={current >= pages}
                      onClick={() => setPage(current + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </GlassCard>
            )}
            <p className="text-xs leading-6 text-text-muted">
              Recipient addresses are public. Demo auditor keys can decrypt
              covered salaries. Payroll runs execute atomically; individual
              partial settlement is not supported. This deployment has no
              scheduling, approvals or organization management.
            </p>
          </>
        )}
      </div>
      <Modal
        open={createOpen}
        busy={!!busy}
        onClose={() => setCreateOpen(false)}
        title="Create recipient template"
      >
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <p className="text-sm leading-6 text-text-secondary">
          Add registered Testnet recipients. Addresses are stored on-chain; no
          salaries are stored in the template.
        </p>
        {addresses.map((a, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Input
                label={`Recipient ${i + 1}`}
                placeholder="G…"
                value={a}
                disabled={!!busy}
                onChange={(e) =>
                  setAddresses((prev) =>
                    prev.map((v, j) => (j === i ? e.target.value : v)),
                  )
                }
                className="font-mono text-sm"
                error={
                  a.trim() && !StrKey.isValidEd25519PublicKey(a.trim())
                    ? "Enter a valid Stellar G address."
                    : undefined
                }
              />
            </div>
            <Button
              variant="ghost"
              aria-label={`Remove recipient ${i + 1}`}
              disabled={addresses.length === 1 || !!busy}
              onClick={() =>
                setAddresses((prev) => prev.filter((_, j) => j !== i))
              }
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          disabled={!!busy}
          onClick={() => setAddresses((prev) => [...prev, ""])}
        >
          Add recipient
        </Button>
        <p className="text-xs text-text-muted">
          Registration is checked before the wallet approval.
        </p>
        <Button
          disabled={
            !ready ||
            !!busy ||
            uncertain ||
            addresses.some((a) => !StrKey.isValidEd25519PublicKey(a.trim())) ||
            new Set(addresses.map((a) => a.trim())).size !== addresses.length
          }
          isLoading={busy === "template"}
          onClick={createTemplate}
        >
          Create template on Testnet
        </Button>
      </Modal>
      <Modal
        open={executing !== null}
        busy={!!busy}
        onClose={() => setExecuting(null)}
        title={`${review ? "Review" : "Prepare"} payroll · Run #${executing?.id ?? ""}`}
      >
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <p className="text-sm leading-6 text-text-secondary">
          {review
            ? "Check every recipient and amount. The whole batch settles together after proof generation and wallet approval."
            : "Enter a salary for every recipient. All salaries must be positive and within your available balance."}
        </p>
        <div className="space-y-3">
          {employees.map((a, i) => (
            <div
              key={a}
              className="grid items-center gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1fr_180px]"
            >
              <div>
                <span className="mb-2 block text-xs text-text-muted">
                  Recipient {i + 1}
                </span>
                <AddressDisplay address={a} chars={7} />
              </div>
              {review ? (
                <p className="font-mono text-right">{salaries[a]} USDC</p>
              ) : (
                <Input
                  label={`Salary for recipient ${i + 1} (USDC)`}
                  inputMode="decimal"
                  value={salaries[a] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^\d*(?:\.\d{0,7})?$/.test(v))
                      setSalaries((prev) => ({ ...prev, [a]: v }));
                  }}
                  className="text-right font-mono"
                />
              )}
            </div>
          ))}
        </div>
        <dl className="space-y-3 rounded-lg bg-card p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt>Batch total</dt>
            <dd className="font-mono">{formatAmount(total, 7)} USDC</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">Available balance</dt>
            <dd className="font-mono">{formatAmount(available, 7)} USDC</dd>
          </div>
        </dl>
        {total > available && (
          <p role="alert" className="text-sm text-error">
            The total exceeds your available balance.
          </p>
        )}
        <p className="text-xs leading-6 text-text-muted">
          Network fees use XLM and are shown by your wallet after simulation. If
          confirmation is uncertain, check the run and account state before
          retrying.
        </p>
        <div className="flex gap-3">
          <Button
            disabled={!ready || !valid || !!busy || uncertain}
            isLoading={busy === "execute"}
            onClick={() => (review ? execute() : setReview(true))}
          >
            {review ? "Confirm and pay batch" : "Review payroll"}
          </Button>
          {review && (
            <Button
              variant="secondary"
              disabled={!!busy}
              onClick={() => setReview(false)}
            >
              Edit amounts
            </Button>
          )}
        </div>
      </Modal>
      <Modal
        open={cancel !== null}
        busy={!!busy}
        onClose={() => setCancel(null)}
        title="Cancel draft run"
      >
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <p className="text-sm text-text-secondary">
          Cancel Run #{cancel?.id.toString()}. This does not execute any
          salaries.
        </p>
        <Button
          variant="danger"
          disabled={!!busy || uncertain}
          onClick={async () => {
            if (
              cancel &&
              (await run("cancel", () => wallet.cancelRun(cancel.id), {
                refresh: false,
              }))
            ) {
              setCancel(null);
              reload();
            }
          }}
        >
          Confirm cancellation
        </Button>
      </Modal>
      <ProofLoadingOverlay
        open={busy === "execute" && phase === "proving"}
        fullScreen
      />
    </AppShell>
  );
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="py-12 text-center">
      <Briefcase className="mx-auto mb-4 h-7 w-7 text-text-muted" />
      <h3 className="font-medium">{title}</h3>
      <p className="mt-2 text-sm text-text-muted">{detail}</p>
    </div>
  );
}
