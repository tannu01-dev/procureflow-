"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const severityStyles = {
  info: "border-slate-200 bg-slate-50 text-slate-700",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-orange-200 bg-orange-50 text-orange-800",
  critical: "border-rose-200 bg-rose-50 text-rose-800",
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function StatCard({ label, value, helper, tone = "default" }) {
  const tones = {
    default: "border-[#e8e3dc] bg-white",
    warning: "border-amber-200 bg-amber-50/70",
    danger: "border-rose-200 bg-rose-50/70",
    purple: "border-[#e2dbee] bg-[#f4f0fa]",
  };
  return (
    <div className={`rounded-2xl border p-5 shadow-sm shadow-slate-900/[0.02] ${tones[tone]}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-[#242333]">{value ?? 0}</p>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

export default function RiskCenterPage() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [severity, setSeverity] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (severity !== "all") params.set("severity", severity);
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [page, severity, search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryResult, logResult] = await Promise.all([
        apiRequest("/audit-logs/summary"),
        apiRequest(`/audit-logs?${queryString}`),
      ]);
      setSummary(summaryResult.summary || null);
      setLogs(logResult.logs || []);
      setPagination(logResult.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      if (err.status === 401) {
        sessionStorage.removeItem("procureflow_token");
        sessionStorage.removeItem("procureflow_user");
        router.replace("/");
        return;
      }
      setError(err.message || "Could not load audit data.");
    } finally {
      setLoading(false);
    }
  }, [queryString, router]);

  useEffect(() => {
    const storedUser = sessionStorage.getItem("procureflow_user");
    if (!sessionStorage.getItem("procureflow_token") || !storedUser) {
      router.replace("/");
      return;
    }
    try {
      const user = JSON.parse(storedUser);
      if (!["company_admin", "procurement_manager", "finance", "auditor"].includes(user?.role)) {
        router.replace(({ company_admin: "/admin", procurement_manager: "/procurement", requester: "/requests", approver: "/approvals", finance: "/finance", auditor: "/audit" })[user?.role] || "/");
        return;
      }
    } catch {
      router.replace("/");
      return;
    }
    loadData();
  }, [loadData, router]);

  function exportCsv() {
    if (!logs.length) {
      setNotice("There are no visible records to export.");
      return;
    }
    const columns = ["occurredAt", "actorName", "actorEmail", "actorRole", "action", "method", "path", "statusCode", "severity", "outcome", "message"];
    const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [columns.join(","), ...logs.map((log) => columns.map((column) => escapeCsv(log[column])).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `procureflow-audit-page-${page}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Current filtered page exported.");
  }

  const severityCounts = summary?.severityCounts || {};

  return (
    <main className="min-h-screen bg-[#F7F5F1] text-[#242333]">
      <header className="border-b border-[#e6e1da] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <Link href="/" className="text-lg font-bold tracking-tight">ProcureFlow</Link>
            <p className="mt-1 text-xs text-slate-500">Security, risk & compliance</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={loadData} className="rounded-xl border border-[#ded7e9] px-4 py-2.5 text-sm font-semibold hover:bg-[#f7f4fb]">Refresh</button>
            <button onClick={exportCsv} className="rounded-xl bg-[#242333] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#39374b]">Export visible logs</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8D7BB8]">Phase 13 · Risk Center</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Audit & Risk Overview</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Review authenticated write actions, failed API requests and sensitive procurement activity for your company workspace.</p>
          </div>
          <span className="w-fit rounded-full border border-[#ded7e9] bg-white px-3 py-1.5 text-xs font-semibold text-[#67558d]">Last 30 days</span>
        </div>

        {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
        {notice && <div role="status" className="mb-5 rounded-xl border border-[#ded7e9] bg-white p-3 text-sm text-slate-700">{notice}</div>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Recorded events" value={summary?.totalEvents} helper="Authenticated write actions" tone="purple" />
          <StatCard label="Failed actions" value={summary?.failedEvents} helper="Responses with HTTP 4xx or 5xx" tone="warning" />
          <StatCard label="High-risk events" value={summary?.highRiskEvents} helper="Sensitive routes or denied requests" tone="warning" />
          <StatCard label="Critical events" value={summary?.criticalEvents} helper="Server errors (HTTP 5xx)" tone="danger" />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-[#e8e3dc] bg-white p-6">
            <h2 className="text-lg font-bold">Severity distribution</h2>
            <p className="mt-1 text-sm text-slate-500">Events recorded during the last 30 days.</p>
            <div className="mt-5 space-y-4">
              {["critical", "high", "medium", "info"].map((level) => {
                const count = severityCounts[level] || 0;
                const max = Math.max(1, ...Object.values(severityCounts).map(Number));
                const width = `${Math.min(100, (count / max) * 100)}%`;
                return <div key={level}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="capitalize text-slate-600">{level}</span><strong>{count}</strong></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${level === "critical" ? "bg-rose-500" : level === "high" ? "bg-orange-400" : level === "medium" ? "bg-amber-300" : "bg-[#a99aca]"}`} style={{ width }} /></div>
                </div>;
              })}
            </div>
            <p className="mt-5 rounded-xl bg-[#f7f5fb] p-3 text-xs leading-5 text-slate-600">Risk labels are rule-based indicators, not a guarantee that an event is malicious. Investigate high and critical events in context.</p>
          </div>

          <div className="rounded-2xl border border-[#e8e3dc] bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-bold">Recent high-risk activity</h2><p className="mt-1 text-sm text-slate-500">Latest high and critical events.</p></div>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Review recommended</span>
            </div>
            <div className="mt-4 space-y-3">
              {(summary?.recentHighRisk || []).length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">No high-risk events recorded in the last 30 days.</p>}
              {(summary?.recentHighRisk || []).map((log) => <div key={log._id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{log.action}</strong><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${severityStyles[log.severity] || severityStyles.info}`}>{log.severity}</span></div>
                <p className="mt-2 break-all text-xs text-slate-600">{log.path} · HTTP {log.statusCode}</p>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>{log.actorName} · {log.actorRole}</span><span>{formatDate(log.occurredAt)}</span></div>
              </div>)}
            </div>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#e8e3dc] bg-white">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div><h2 className="text-lg font-bold">Audit event log</h2><p className="mt-1 text-sm text-slate-500">{pagination.total || 0} matching records · newest first</p></div>
              <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px]">
                <input aria-label="Search audit logs" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search user, action or route…" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#a99aca] focus:ring-2 focus:ring-[#a99aca]/20" />
                <select aria-label="Filter by severity" value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(1); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#a99aca]"><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="info">Info</option></select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[950px] w-full text-left text-sm">
              <thead className="bg-[#faf9f7] text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-semibold">Time</th><th className="px-5 py-3 font-semibold">Actor</th><th className="px-5 py-3 font-semibold">Action / route</th><th className="px-5 py-3 font-semibold">Outcome</th><th className="px-5 py-3 font-semibold">Severity</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading && <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-500">Loading audit events…</td></tr>}
                {!loading && logs.length === 0 && <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-500">No audit records match these filters.</td></tr>}
                {!loading && logs.map((log) => <tr key={log._id} className="align-top hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{formatDate(log.occurredAt)}</td>
                  <td className="px-5 py-4"><p className="font-semibold">{log.actorName || "Unknown user"}</p><p className="mt-1 text-xs text-slate-500">{log.actorEmail || log.actorRole}</p></td>
                  <td className="max-w-md px-5 py-4"><p className="font-semibold">{log.action}</p><p className="mt-1 break-all text-xs text-slate-500">{log.method} {log.path}</p><p className="mt-1 text-xs text-slate-500">HTTP {log.statusCode} · {log.message}</p></td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${log.outcome === "failure" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{log.outcome}</span></td>
                  <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${severityStyles[log.severity] || severityStyles.info}`}>{log.severity}</span></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm">
            <p className="text-slate-500">Page {pagination.page || page} of {Math.max(1, pagination.pages || 1)}</p>
            <div className="flex gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Previous</button><button disabled={page >= (pagination.pages || 1) || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Next</button></div>
          </div>
        </section>

        <p className="mt-5 text-xs leading-5 text-slate-500">Audit records are append-only through this API. This phase records authenticated write requests; it does not yet capture every read action or every database change made outside the API.</p>
      </div>
    </main>
  );
}
