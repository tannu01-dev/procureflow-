
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

export default function ApprovalsPage() {
  const router = useRouter();

  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await apiRequest("/approvals");

      const queue = Array.isArray(result.requests) ? result.requests : [];
      setRequests(queue);

      setSelected((previous) => {
        if (!previous) return queue[0] || null;
        return queue.find((item) => item._id === previous._id) || queue[0] || null;
      });
    } catch (err) {
      if (err.status === 401) {
        router.replace("/");
        return;
      }

      setError(err.message || "Could not load approval queue.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = sessionStorage.getItem("procureflow_token");

    if (!token) {
      router.replace("/");
      return;
    }

    try {
      const user = JSON.parse(
        sessionStorage.getItem("procureflow_user") || "null"
      );

      const allowedRoles = [
        "company_admin",
        "procurement_manager",
        "approver",
      ];

      if (!allowedRoles.includes(user?.role)) {
        router.replace(
          user?.role === "requester" ? "/requests" : "/"
        );
        return;
      }
    } catch {
      router.replace("/");
      return;
    }

    loadQueue();
  }, [loadQueue, router]);

  async function processRequest(action) {
    if (!selected || actionLoading) return;

    if (action === "reject" && !comment.trim()) {
      setError("Please enter a rejection reason.");
      return;
    }

    const confirmed = window.confirm(
      action === "approve"
        ? "Are you sure you want to approve this purchase request?"
        : "Are you sure you want to reject this purchase request?"
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        `/approvals/${selected._id}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({ comment: comment.trim() }),
        }
      );

      setMessage(result.message || "Request processed successfully.");
      setComment("");
      setSelected(null);

      await loadQueue();
    } catch (err) {
      setError(err.message || "Could not process this request.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F5F1] text-[#242333]">
        Loading approval queue...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F5F1] px-4 py-8 text-[#242333] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8D7BB8]">
              Procurement workflow
            </p>
            <h1 className="mt-2 text-3xl font-bold">Approval centre</h1>
            <p className="mt-2 text-sm text-gray-600">
              Review submitted requests before they move to procurement.
            </p>
          </div>

          <button
            type="button"
            onClick={loadQueue}
            className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-gray-50"
          >
            Refresh queue
          </button>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {message}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Metric
            label="Awaiting approval"
            value={requests.length}
            detail="Submitted requests"
          />
          <Metric
            label="High priority"
            value={
              requests.filter(
                (request) =>
                  request.priority === "high" ||
                  request.priority === "urgent"
              ).length
            }
            detail="Needs closer attention"
          />
          <Metric
            label="Total pending value"
            value={money(
              requests.reduce(
                (sum, request) => sum + Number(request.totalAmount || 0),
                0
              )
            )}
            detail="Combined request value"
          />
        </div>

        {requests.length === 0 ? (
          <section className="rounded-2xl border border-[#e6e1da] bg-white px-5 py-16 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#E9E5F2] text-2xl">
              ✓
            </div>
            <h2 className="mt-4 text-xl font-bold">
              No requests awaiting approval
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              New submitted requests will appear here.
            </p>
          </section>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[0.85fr_1.4fr]">
            <section className="rounded-2xl border border-[#e6e1da] bg-white p-4">
              <div className="mb-4 flex items-center justify-between px-1">
                <h2 className="font-bold">Pending queue</h2>
                <span className="rounded-full bg-[#E9E5F2] px-3 py-1 text-xs font-semibold">
                  {requests.length}
                </span>
              </div>

              <div className="space-y-3">
                {requests.map((request) => {
                  const isSelected = selected?._id === request._id;

                  return (
                    <button
                      type="button"
                      key={request._id}
                      onClick={() => {
                        setSelected(request);
                        setComment("");
                        setError("");
                      }}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        isSelected
                          ? "border-[#8D7BB8] bg-[#F7F5FB]"
                          : "border-gray-200 hover:border-[#c7bbdf]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{request.title}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                            request.priority === "urgent"
                              ? "bg-red-100 text-red-700"
                              : request.priority === "high"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {request.priority}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-gray-500">
                        {request.requestNumber}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500">
                          {request.requestedBy?.name || "Requester"}
                        </span>
                        <span className="text-sm font-bold">
                          {money(request.totalAmount)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {selected ? (
              <section className="rounded-2xl border border-[#e6e1da] bg-white p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#8D7BB8]">
                      {selected.requestNumber}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">
                      {selected.title}
                    </h2>
                    <p className="mt-2 text-sm text-gray-500">
                      Submitted by {selected.requestedBy?.name || "Requester"}
                    </p>
                  </div>

                  <span className="rounded-full bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-800">
                    Submitted
                  </span>
                </div>

                <div className="mt-6 grid gap-4 rounded-xl bg-[#F7F5F1] p-4 sm:grid-cols-2">
                  <Info
                    label="Department"
                    value={selected.department || "Not specified"}
                  />
                  <Info
                    label="Priority"
                    value={selected.priority}
                    capitalize
                  />
                  <Info
                    label="Required by"
                    value={
                      selected.neededBy
                        ? new Date(selected.neededBy).toLocaleDateString("en-IN")
                        : "Not specified"
                    }
                  />
                  <Info
                    label="Submitted on"
                    value={
                      selected.submittedAt
                        ? new Date(selected.submittedAt).toLocaleDateString("en-IN")
                        : "—"
                    }
                  />
                </div>

                {selected.description && (
                  <div className="mt-5">
                    <h3 className="text-sm font-bold">Business justification</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                      {selected.description}
                    </p>
                  </div>
                )}

                <div className="mt-7">
                  <h3 className="font-bold">Requested items</h3>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[450px] text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase text-gray-500">
                          <th className="py-3 pr-3">Item</th>
                          <th className="py-3 pr-3">Qty</th>
                          <th className="py-3 pr-3">Unit price</th>
                          <th className="py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.items || []).map((item) => (
                          <tr
                            key={item._id}
                            className="border-b border-gray-100"
                          >
                            <td className="py-3 pr-3">
                              <p className="font-medium">{item.name}</p>
                              {item.description && (
                                <p className="mt-1 text-xs text-gray-500">
                                  {item.description}
                                </p>
                              )}
                            </td>
                            <td className="py-3 pr-3">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="py-3 pr-3">
                              {money(item.unitPrice)}
                            </td>
                            <td className="py-3 text-right font-semibold">
                              {money(item.lineTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <div className="rounded-xl bg-[#242333] px-5 py-4 text-white">
                      <p className="text-xs text-gray-300">Total request value</p>
                      <p className="mt-1 text-2xl font-bold">
                        {money(selected.totalAmount)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-7 border-t border-gray-100 pt-6">
                  <label className="block">
                    <span className="text-sm font-bold">
                      Approval comment / rejection reason
                    </span>
                    <textarea
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      maxLength={1000}
                      rows={3}
                      placeholder="Add your review notes. A reason is required to reject."
                      className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8D7BB8]"
                    />
                  </label>

                  <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => processRequest("reject")}
                      className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
                    >
                      {actionLoading ? "Processing..." : "Reject request"}
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => processRequest("approve")}
                      className="rounded-xl bg-[#242333] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {actionLoading ? "Processing..." : "Approve request"}
                    </button>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-gray-500">
                    You cannot approve or reject your own request. Once
                    processed, a request leaves the pending queue.
                  </p>
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-[#e6e1da] bg-white p-10 text-center text-sm text-gray-500">
                Select a request from the queue.
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-[#e6e1da] bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-3 break-words text-2xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

function Info({ label, value, capitalize = false }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className={`mt-1 text-sm font-semibold ${capitalize ? "capitalize" : ""}`}>
        {value}
      </p>
    </div>
  );
}
