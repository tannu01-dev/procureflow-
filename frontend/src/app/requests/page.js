"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

const statusLabels = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const statusClasses = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-orange-100 text-orange-800",
};

export default function PurchaseRequestsPage() {
  const router = useRouter();

  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query = status
        ? `?status=${encodeURIComponent(status)}`
        : "";

      const result = await apiRequest(`/purchase-requests${query}`);

      setRequests(Array.isArray(result.requests) ? result.requests : []);
    } catch (err) {
      if (err.status === 401) {
        router.replace("/");
        return;
      }

      setError(err.message || "Could not load purchase requests.");
    } finally {
      setLoading(false);
    }
  }, [status, router]);

  useEffect(() => {
    if (!sessionStorage.getItem("procureflow_token")) {
      router.replace("/");
      return;
    }

    loadRequests();
  }, [loadRequests, router]);

  return (
    <main className="min-h-screen bg-[#F7F5F1] px-4 py-8 text-[#242333] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8D7BB8]">
              Procurement workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Purchase requests
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Create, track and manage purchase requests for your organisation.
            </p>
          </div>

          <Link
            href="/requests/new"
            className="inline-flex items-center justify-center rounded-xl bg-[#242333] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#39374b]"
          >
            + New request
          </Link>
        </header>

        <section className="mb-5 grid gap-4 sm:grid-cols-3">
          <Metric
            label="Visible requests"
            value={requests.length}
            detail="Based on current filter"
          />
          <Metric
            label="Drafts"
            value={requests.filter((item) => item.status === "draft").length}
            detail="Not submitted yet"
          />
          <Metric
            label="Submitted"
            value={
              requests.filter((item) => item.status === "submitted").length
            }
            detail="Awaiting next workflow step"
          />
        </section>

        <section className="rounded-2xl border border-[#e6e1da] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">All requests</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select a request to view its details.
              </p>
            </div>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#8D7BB8]"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
              <button
                type="button"
                onClick={loadRequests}
                className="ml-3 font-bold underline"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Loading purchase requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-5 py-14 text-center">
              <h3 className="font-semibold">No purchase requests found</h3>
              <p className="mt-2 text-sm text-gray-500">
                Create your first request to get started.
              </p>
              <Link
                href="/requests/new"
                className="mt-5 inline-flex rounded-xl bg-[#E9E5F2] px-4 py-2.5 text-sm font-semibold text-[#39334b]"
              >
                Create request
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-3 py-4">Request</th>
                    <th className="px-3 py-4">Created by</th>
                    <th className="px-3 py-4">Items</th>
                    <th className="px-3 py-4">Total</th>
                    <th className="px-3 py-4">Status</th>
                    <th className="px-3 py-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((item) => (
                    <tr
                      key={item._id}
                      onClick={() => router.push(`/requests/${item._id}`)}
                      className="cursor-pointer border-b border-gray-50 transition hover:bg-[#faf9fc]"
                    >
                      <td className="px-3 py-4">
                        <p className="font-semibold">{item.title}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {item.requestNumber}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        {item.requestedBy?.name || "You"}
                      </td>
                      <td className="px-3 py-4">
                        {item.items?.length || 0}
                      </td>
                      <td className="px-3 py-4 font-semibold">
                        {money(item.totalAmount)}
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            statusClasses[item.status] ||
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {statusLabels[item.status] || item.status}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-gray-500">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleDateString("en-IN")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-[#e6e1da] bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </div>
  );
}