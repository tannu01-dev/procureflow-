"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const statuses = [
  "draft",
  "issued",
  "acknowledged",
  "partially_received",
  "received",
  "cancelled",
];

const statusColors = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-700",
  acknowledged: "bg-purple-100 text-purple-700",
  partially_received: "bg-amber-100 text-amber-800",
  received: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const nextStatuses = {
  draft: ["issued", "cancelled"],
  issued: [
    "acknowledged",
    "partially_received",
    "received",
    "cancelled",
  ],
  acknowledged: ["partially_received", "received", "cancelled"],
  partially_received: ["received", "cancelled"],
  received: [],
  cancelled: [],
};

function formatCurrency(amount, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
}

function formatDate(date) {
  if (!date) return "Not set";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "Not set";

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getId(value) {
  if (!value) return "";
  return String(value._id || value.id || value);
}

export default function PurchaseOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [quotations, setQuotations] = useState([]);

  const [selectedRFQ, setSelectedRFQ] = useState("");
  const [selectedQuotation, setSelectedQuotation] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [updatingId, setUpdatingId] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadOrders = useCallback(async () => {
    const result = await apiRequest("/purchase-orders");
    setOrders(result.purchaseOrders || []);
  }, []);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [orderResult, rfqResult] = await Promise.all([
        apiRequest("/purchase-orders"),
        apiRequest("/rfqs"),
      ]);

      setOrders(orderResult.purchaseOrders || []);
      setRfqs(rfqResult.rfqs || []);
    } catch (err) {
      if (err.status === 401) {
        router.replace("/");
        return;
      }

      setError(err.message || "Could not load purchase orders.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  async function handleRFQChange(rfqId) {
    setSelectedRFQ(rfqId);
    setSelectedQuotation("");
    setQuotations([]);
    setError("");
    setMessage("");

    if (!rfqId) return;

    setLoadingQuotes(true);

    try {
      const result = await apiRequest(
        `/rfqs/${encodeURIComponent(rfqId)}/quotations`
      );

      setQuotations(result.quotations || []);
    } catch (err) {
      setError(err.message || "Could not load quotations for this RFQ.");
    } finally {
      setLoadingQuotes(false);
    }
  }

  async function handleCreatePO(event) {
    event.preventDefault();

    if (!selectedRFQ || !selectedQuotation) {
      setError("Please select an RFQ and a quotation.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest("/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          quotationId: selectedQuotation,
          expectedDeliveryDate: expectedDeliveryDate || undefined,
          notes: notes.trim(),
        }),
      });

      setMessage(
        result.message || "Purchase order created successfully."
      );

      setShowCreateForm(false);
      setSelectedRFQ("");
      setSelectedQuotation("");
      setExpectedDeliveryDate("");
      setNotes("");
      setQuotations([]);

      await loadOrders();
    } catch (err) {
      setError(err.message || "Could not create the purchase order.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(order, status) {
    const prompts = {
      issued: "Issue this purchase order to the selected vendor?",
      acknowledged: "Mark this purchase order as acknowledged?",
      partially_received: "Mark this order as partially received?",
      received: "Confirm that this order has been fully received?",
      cancelled: "Cancel this purchase order?",
    };

    if (!window.confirm(prompts[status] || `Change status to ${status}?`)) {
      return;
    }

    setUpdatingId(order._id);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        `/purchase-orders/${encodeURIComponent(order._id)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      );

      setMessage(
        result.message || "Purchase order status updated successfully."
      );

      await loadOrders();
    } catch (err) {
      setError(err.message || "Could not update purchase order status.");
    } finally {
      setUpdatingId("");
    }
  }

  const totalValue = orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  const draftCount = orders.filter(
    (order) => order.status === "draft"
  ).length;

  const activeCount = orders.filter((order) =>
    ["issued", "acknowledged", "partially_received"].includes(
      order.status
    )
  ).length;

  const receivedCount = orders.filter(
    (order) => order.status === "received"
  ).length;

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F5F1] text-[#242333]">
        Loading purchase orders...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F5F1] text-[#242333]">
      <header className="border-b border-[#e6e1da] bg-white px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-xl font-bold">
              ProcureFlow
            </Link>
            <p className="mt-1 text-sm text-gray-500">
              Purchase Order Management
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/rfqs"
              className="rounded-xl border border-[#d9d0e9] px-4 py-2.5 text-sm font-semibold hover:bg-[#E9E5F2]"
            >
              RFQ & Quotations
            </Link>

            <button
              type="button"
              onClick={() => {
                setShowCreateForm((current) => !current);
                setError("");
                setMessage("");
              }}
              className="rounded-xl bg-[#242333] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#39374b]"
            >
              + Create Purchase Order
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8D7BB8]">
            Procurement operations
          </p>

          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Purchase Orders
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            Create purchase orders from submitted vendor quotations,
            issue approved orders and track delivery progress.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            {message}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total purchase orders"
            value={orders.length}
            description="All recorded orders"
          />

          <SummaryCard
            title="Draft orders"
            value={draftCount}
            description="Not yet issued"
          />

          <SummaryCard
            title="In progress"
            value={activeCount}
            description="Issued or awaiting delivery"
          />

          <SummaryCard
            title="Received"
            value={receivedCount}
            description="Marked as fully received"
          />
        </section>

        <section className="mt-5 rounded-2xl border border-[#e6e1da] bg-white p-6">
          <p className="text-sm text-gray-500">Total PO value</p>
          <h2 className="mt-2 text-3xl font-bold">
            {formatCurrency(totalValue)}
          </h2>
          <p className="mt-2 text-xs text-gray-500">
            Excludes cancelled purchase orders.
          </p>
        </section>

        {showCreateForm && (
          <section className="mt-8 rounded-2xl border border-[#e6e1da] bg-white p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold">
                Create a purchase order
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Select an RFQ and one of its submitted quotations.
                The backend calculates the final order amount.
              </p>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-5">
              <div>
                <label
                  htmlFor="rfq"
                  className="mb-2 block text-sm font-semibold"
                >
                  RFQ
                </label>

                <select
                  id="rfq"
                  value={selectedRFQ}
                  onChange={(event) =>
                    handleRFQChange(event.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#8D7BB8]"
                >
                  <option value="">Select an RFQ</option>

                  {rfqs.map((rfq) => (
                    <option key={rfq._id} value={rfq._id}>
                      {rfq.title || "Untitled RFQ"} —{" "}
                      {rfq.status || "unknown status"}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRFQ && (
                <div>
                  <label
                    htmlFor="quotation"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Submitted quotation
                  </label>

                  {loadingQuotes ? (
                    <p className="text-sm text-gray-500">
                      Loading quotations...
                    </p>
                  ) : (
                    <select
                      id="quotation"
                      value={selectedQuotation}
                      onChange={(event) =>
                        setSelectedQuotation(event.target.value)
                      }
                      required
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#8D7BB8]"
                    >
                      <option value="">
                        Select a vendor quotation
                      </option>

                      {quotations
                        .filter((quote) => quote.status === "submitted")
                        .map((quote) => (
                          <option key={quote._id} value={quote._id}>
                            {quote.quotationNumber || "Quotation"} —{" "}
                            {quote.vendorId?.name || "Vendor"} —{" "}
                            {formatCurrency(
                              quote.totalAmount,
                              quote.currency || "INR"
                            )}
                          </option>
                        ))}
                    </select>
                  )}

                  {!loadingQuotes && quotations.length === 0 && (
                    <p className="mt-2 text-sm text-amber-700">
                      No quotations are available for this RFQ yet.
                    </p>
                  )}
                </div>
              )}

              {selectedQuotation &&
                (() => {
                  const quote = quotations.find(
                    (item) => item._id === selectedQuotation
                  );

                  if (!quote) return null;

                  return (
                    <div className="rounded-xl border border-[#e6e1da] bg-[#F7F5F1] p-4">
                      <h3 className="font-semibold">
                        Selected quotation summary
                      </h3>

                      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        <p>
                          <span className="text-gray-500">Vendor: </span>
                          {quote.vendorId?.name || "Vendor"}
                        </p>

                        <p>
                          <span className="text-gray-500">Subtotal: </span>
                          {formatCurrency(
                            quote.subtotal,
                            quote.currency || "INR"
                          )}
                        </p>

                        <p>
                          <span className="text-gray-500">Tax: </span>
                          {formatCurrency(
                            quote.taxAmount,
                            quote.currency || "INR"
                          )}
                        </p>

                        <p className="font-bold">
                          Total:{" "}
                          {formatCurrency(
                            quote.totalAmount,
                            quote.currency || "INR"
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })()}

              <div>
                <label
                  htmlFor="expectedDeliveryDate"
                  className="mb-2 block text-sm font-semibold"
                >
                  Expected delivery date (optional)
                </label>

                <input
                  id="expectedDeliveryDate"
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(event) =>
                    setExpectedDeliveryDate(event.target.value)
                  }
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8D7BB8] sm:max-w-md"
                />
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="mb-2 block text-sm font-semibold"
                >
                  Notes (optional)
                </label>

                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Add delivery instructions or internal notes..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8D7BB8]"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving || loadingQuotes}
                  className="rounded-xl bg-[#242333] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create draft PO"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">All purchase orders</h2>
              <p className="mt-1 text-sm text-gray-600">
                {orders.length} order(s) found.
              </p>
            </div>

            <button
              type="button"
              onClick={loadOrders}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d9d0e9] bg-white p-10 text-center">
              <h3 className="text-lg font-bold">
                No purchase orders yet
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                Create your first PO from a submitted vendor quotation.
              </p>

              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="mt-5 rounded-xl bg-[#242333] px-5 py-3 text-sm font-semibold text-white"
              >
                Create your first PO
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <article
                  key={order._id}
                  className="rounded-2xl border border-[#e6e1da] bg-white p-5 sm:p-6"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-bold">
                          {order.poNumber}
                        </h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            statusColors[order.status] ||
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {order.status?.replaceAll("_", " ")}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-gray-600">
                        {order.rfqId?.title || "RFQ"}
                      </p>

                      <p className="mt-1 text-sm text-gray-600">
                        Vendor: {order.vendorId?.name || "Vendor"}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Created: {formatDate(order.createdAt)}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Expected delivery:{" "}
                        {formatDate(order.expectedDeliveryDate)}
                      </p>
                    </div>

                    <div className="lg:text-right">
                      <p className="text-sm text-gray-500">
                        Total order value
                      </p>

                      <p className="mt-1 text-2xl font-bold">
                        {formatCurrency(
                          order.totalAmount,
                          order.currency || "INR"
                        )}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {order.items?.length || 0} item(s)
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <h4 className="text-sm font-semibold">
                      Order items
                    </h4>

                    <div className="mt-3 space-y-2">
                      {(order.items || []).map((item, index) => (
                        <div
                          key={`${order._id}-${index}`}
                          className="flex flex-wrap justify-between gap-2 text-sm"
                        >
                          <span className="text-gray-700">
                            {item.name} × {item.quantity}
                          </span>

                          <span className="font-medium">
                            {formatCurrency(
                              item.lineTotal,
                              order.currency || "INR"
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {order.notes && (
                    <p className="mt-4 rounded-lg bg-[#F7F5F1] p-3 text-sm text-gray-600">
                      <strong>Notes:</strong> {order.notes}
                    </p>
                  )}

                  {nextStatuses[order.status]?.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {nextStatuses[order.status].map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={updatingId === order._id}
                          onClick={() => changeStatus(order, status)}
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition disabled:opacity-50 ${
                            status === "cancelled"
                              ? "border-red-200 text-red-700 hover:bg-red-50"
                              : "border-[#d9d0e9] bg-[#E9E5F2] text-[#39334b] hover:bg-[#ddd6ed]"
                          }`}
                        >
                          {updatingId === order._id
                            ? "Updating..."
                            : status === "issued"
                              ? "Issue PO"
                              : status.replaceAll("_", " ")}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="mt-8 text-xs leading-5 text-gray-500">
          Note: This module records PO creation, issue and status changes.
          It does not yet send vendor emails or perform actual payments.
          Goods receipt processing will be added in the delivery and GRN phase.
        </p>
      </div>
    </main>
  );
}

function SummaryCard({ title, value, description }) {
  return (
    <div className="rounded-2xl border border-[#e6e1da] bg-white p-5">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{description}</p>
    </div>
  );
}