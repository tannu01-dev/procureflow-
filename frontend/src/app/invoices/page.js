
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

const C = {
  page: "#F7F5F1",
  ink: "#242333",
  muted: "#716F7E",
  accent: "#8D7BB8",
  border: "#E9E5F2",
  soft: "#F7F5FA",
  white: "#FFFFFF",
  green: "#276844",
  greenBg: "#E8F5EC",
  red: "#A02C2C",
  redBg: "#FCE8E8",
  amber: "#8A5A12",
  amberBg: "#FFF0D9",
};

const card = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 22,
  marginBottom: 22,
  boxShadow: "0 4px 16px rgba(36,35,51,0.04)",
};

const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #DCD7E8",
  borderRadius: 9,
  background: C.white,
  color: C.ink,
  fontSize: 14,
};

const primaryButton = {
  border: 0,
  borderRadius: 9,
  padding: "11px 15px",
  background: C.accent,
  color: C.white,
  fontWeight: 750,
  fontSize: 13,
  cursor: "pointer",
};

const secondaryButton = {
  border: `1px solid #DCD7E8`,
  borderRadius: 8,
  padding: "9px 12px",
  background: C.white,
  color: C.ink,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

function money(value, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateLabel(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status) {
  return String(status || "draft")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusStyle(status) {
  if (status === "matched" || status === "approved") {
    return { background: C.greenBg, color: C.green };
  }

  if (status === "discrepancy" || status === "rejected") {
    return { background: C.redBg, color: C.red };
  }

  return { background: C.amberBg, color: C.amber };
}

function vendorName(vendor) {
  if (!vendor) return "Unknown vendor";
  if (typeof vendor === "string") return vendor;

  return vendor.name || vendor.email || "Unknown vendor";
}

function orderId(order) {
  const value = order?.purchaseOrderId;

  if (!value) return "";
  return typeof value === "object" ? value._id : value;
}

export default function InvoicesPage() {
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // FIX: Initialize with an empty value to avoid prerendering errors.
  const [invoiceDate, setInvoiceDate] = useState("");

  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceItems, setInvoiceItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  
  useEffect(() => {
    const today = new Date();

    const localDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    setInvoiceDate(localDate);
  }, []);

  const selectedOrder = orders.find(
    (order) => order._id === selectedOrderId
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [orderResponse, invoiceResponse] = await Promise.all([
        apiRequest("/purchase-orders"),
        apiRequest("/invoices"),
      ]);

      setOrders(
        orderResponse.purchaseOrders || orderResponse.orders || []
      );

      setInvoices(invoiceResponse.invoices || []);
    } catch (err) {
      setError(err.message || "Could not load invoices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function selectOrder(id) {
    setSelectedOrderId(id);
    setError("");
    setMessage("");

    const order = orders.find((item) => item._id === id);

    setInvoiceItems(
      (order?.items || []).map((item, index) => ({
        itemIndex: index,
        itemName: item.name,
        orderedQuantity: Number(item.quantity || 0),
        quantity: "",
        unitPrice: String(item.unitPrice ?? ""),
        taxRate: String(item.taxRate ?? 0),
      }))
    );
  }

  function updateInvoiceItem(index, field, value) {
    setInvoiceItems((previous) =>
      previous.map((item) =>
        item.itemIndex === index
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  const enteredItems = invoiceItems.filter(
    (item) => Number(item.quantity) > 0
  );

  const previewSubtotal = enteredItems.reduce(
    (sum, item) =>
      sum + Number(item.quantity) * Number(item.unitPrice),
    0
  );

  const previewTax = enteredItems.reduce(
    (sum, item) =>
      sum +
      (Number(item.quantity) *
        Number(item.unitPrice) *
        Number(item.taxRate)) /
        100,
    0
  );

  const previewTotal = previewSubtotal + previewTax;

  async function createInvoice(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!selectedOrder) {
      setError("Please select a purchase order.");
      return;
    }

    if (!invoiceNumber.trim()) {
      setError("Invoice number is required.");
      return;
    }

    if (enteredItems.length === 0) {
      setError("Enter a positive quantity for at least one item.");
      return;
    }

    setSaving(true);

    try {
      const response = await apiRequest("/invoices", {
        method: "POST",
        body: {
          invoiceNumber: invoiceNumber.trim(),
          purchaseOrderId: selectedOrder._id,
          invoiceDate,
          dueDate: dueDate || undefined,
          notes,
          items: enteredItems.map((item) => ({
            itemIndex: item.itemIndex,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            taxRate: Number(item.taxRate),
          })),
        },
      });

      setMessage(
        response.message || "Invoice created successfully."
      );

      setInvoiceNumber("");
      setDueDate("");
      setNotes("");
      setSelectedOrderId("");
      setInvoiceItems([]);

      await loadData();
    } catch (err) {
      setError(err.message || "Could not create invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function runMatching(invoice) {
    setError("");
    setMessage("");
    setBusyId(invoice._id);

    try {
      const response = await apiRequest(
        `/invoices/${invoice._id}/match`,
        { method: "POST" }
      );

      setMessage(response.message || "Matching completed.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not run matching.");
    } finally {
      setBusyId("");
    }
  }

  async function approveInvoice(invoice) {
    const confirmed = window.confirm(
      `Approve invoice ${invoice.invoiceNumber}?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setBusyId(invoice._id);

    try {
      const response = await apiRequest(
        `/invoices/${invoice._id}/status`,
        {
          method: "PATCH",
          body: { status: "approved" },
        }
      );

      setMessage(response.message || "Invoice approved.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not approve invoice.");
    } finally {
      setBusyId("");
    }
  }

  async function rejectInvoice(invoice) {
    const reason = window.prompt(
      `Enter the rejection reason for ${invoice.invoiceNumber}:`
    );

    if (reason === null) return;

    if (!reason.trim()) {
      setError("A rejection reason is required.");
      return;
    }

    setError("");
    setMessage("");
    setBusyId(invoice._id);

    try {
      const response = await apiRequest(
        `/invoices/${invoice._id}/status`,
        {
          method: "PATCH",
          body: {
            status: "rejected",
            rejectionReason: reason.trim(),
          },
        }
      );

      setMessage(response.message || "Invoice rejected.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not reject invoice.");
    } finally {
      setBusyId("");
    }
  }

  const approvedCount = invoices.filter(
    (invoice) => invoice.status === "approved"
  ).length;

  const discrepancyCount = invoices.filter(
    (invoice) => invoice.status === "discrepancy"
  ).length;

  const pendingCount = invoices.filter((invoice) =>
    ["draft", "matched"].includes(invoice.status)
  ).length;

  const totalValue = invoices
    .filter((invoice) => invoice.status !== "rejected")
    .reduce(
      (sum, invoice) => sum + Number(invoice.totalAmount || 0),
      0
    );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.page,
        color: C.ink,
        padding: "30px 20px 60px",
      }}
    >
      <div style={{ maxWidth: 1250, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 26,
          }}
        >
          <div>
            <p
              style={{
                color: C.accent,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1.5,
              }}
            >
              FINANCE & PROCUREMENT
            </p>

            <h1
              style={{
                fontSize: 30,
                fontWeight: 850,
                margin: "0 0 8px",
              }}
            >
              Invoice Management
            </h1>

            <p style={{ color: C.muted, fontSize: 14 }}>
              Verify supplier invoices against purchase orders and
              accepted deliveries.
            </p>
          </div>

          <Link
            href="/"
            style={{
              color: "#655A7C",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            ← Back to workspace
          </Link>
        </header>

        {error && (
          <div
            role="alert"
            style={{
              background: C.redBg,
              color: C.red,
              padding: 13,
              borderRadius: 9,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            style={{
              background: C.greenBg,
              color: C.green,
              padding: 13,
              borderRadius: 9,
              marginBottom: 16,
            }}
          >
            {message}
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 14,
            marginBottom: 22,
          }}
        >
          {[
            ["Total Invoices", invoices.length],
            ["Pending Review", pendingCount],
            ["Discrepancies", discrepancyCount],
            ["Approved", approvedCount],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                background: C.white,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 19,
              }}
            >
              <p style={{ color: C.muted, fontSize: 13 }}>{label}</p>
              <p style={{ fontSize: 28, fontWeight: 850, margin: 0 }}>
                {value}
              </p>
            </div>
          ))}
        </section>

        <section style={card}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 0 }}>
            Record Supplier Invoice
          </h2>

          <p
            style={{
              color: C.muted,
              fontSize: 13,
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            Select an issued purchase order and enter the quantities
            and prices appearing on the supplier invoice. Matching is
            performed separately before approval.
          </p>

          <form onSubmit={createInvoice}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <div>
                <label
                  htmlFor="po"
                  style={{
                    display: "block",
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 7,
                  }}
                >
                  Purchase Order *
                </label>

                <select
                  id="po"
                  required
                  value={selectedOrderId}
                  onChange={(event) => selectOrder(event.target.value)}
                  style={input}
                >
                  <option value="">Select a purchase order</option>

                  {orders
                    .filter((order) =>
                      [
                        "issued",
                        "acknowledged",
                        "partially_received",
                        "received",
                      ].includes(order.status)
                    )
                    .map((order) => (
                      <option key={order._id} value={order._id}>
                        {order.poNumber} — {vendorName(order.vendorId)} —{" "}
                        {money(order.totalAmount, order.currency)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="invoiceNumber"
                  style={{
                    display: "block",
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 7,
                  }}
                >
                  Supplier Invoice Number *
                </label>

                <input
                  id="invoiceNumber"
                  required
                  maxLength={100}
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                  placeholder="e.g. INV-2026-001"
                  style={input}
                />
              </div>

              <div>
                <label
                  htmlFor="invoiceDate"
                  style={{
                    display: "block",
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 7,
                  }}
                >
                  Invoice Date *
                </label>

                <input
                  id="invoiceDate"
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  style={input}
                />
              </div>

              <div>
                <label
                  htmlFor="dueDate"
                  style={{
                    display: "block",
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 7,
                  }}
                >
                  Due Date
                </label>

                <input
                  id="dueDate"
                  type="date"
                  min={invoiceDate || undefined}
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  style={input}
                />
              </div>
            </div>

            {selectedOrder && (
              <div
                style={{
                  background: C.soft,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 20,
                }}
              >
                <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>
                  Selected Order Summary
                </h3>

                <p style={{ color: C.muted, fontSize: 13 }}>
                  PO: {selectedOrder.poNumber} · Vendor:{" "}
                  {vendorName(selectedOrder.vendorId)}
                </p>

                <p style={{ color: C.muted, fontSize: 13 }}>
                  PO value:{" "}
                  {money(selectedOrder.totalAmount, selectedOrder.currency)}
                </p>

                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      minWidth: 700,
                      borderCollapse: "collapse",
                    }}
                  >
                    <thead>
                      <tr>
                        {[
                          "Item",
                          "PO Quantity",
                          "Invoice Quantity",
                          "Unit Price",
                          "Tax %",
                        ].map((heading) => (
                          <th
                            key={heading}
                            style={{
                              textAlign: "left",
                              padding: "10px 8px",
                              fontSize: 12,
                              color: C.muted,
                              borderBottom: `1px solid ${C.border}`,
                            }}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {invoiceItems.map((item) => (
                        <tr key={item.itemIndex}>
                          <td
                            style={{
                              padding: "10px 8px",
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            {item.itemName}
                          </td>

                          <td style={{ padding: 8, fontSize: 13 }}>
                            {item.orderedQuantity}
                          </td>

                          <td style={{ padding: 8 }}>
                            <input
                              type="number"
                              min="0"
                              max={item.orderedQuantity}
                              step="0.01"
                              value={item.quantity}
                              onChange={(event) =>
                                updateInvoiceItem(
                                  item.itemIndex,
                                  "quantity",
                                  event.target.value
                                )
                              }
                              placeholder="0"
                              style={{ ...input, minWidth: 105 }}
                            />
                          </td>

                          <td style={{ padding: 8 }}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(event) =>
                                updateInvoiceItem(
                                  item.itemIndex,
                                  "unitPrice",
                                  event.target.value
                                )
                              }
                              style={{ ...input, minWidth: 105 }}
                            />
                          </td>

                          <td style={{ padding: 8 }}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.taxRate}
                              onChange={(event) =>
                                updateInvoiceItem(
                                  item.itemIndex,
                                  "taxRate",
                                  event.target.value
                                )
                              }
                              style={{ ...input, minWidth: 80 }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p style={{ fontSize: 13, marginTop: 16 }}>
                  Subtotal: <strong>{money(previewSubtotal)}</strong>
                  {" · "}Tax: <strong>{money(previewTax)}</strong>
                  {" · "}Invoice total:{" "}
                  <strong>{money(previewTotal)}</strong>
                </p>

                <p
                  style={{
                    color: C.muted,
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  These totals are a preview. The backend recalculates
                  the actual invoice amounts.
                </p>
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <label
                htmlFor="notes"
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 7,
                }}
              >
                Notes
              </label>

              <textarea
                id="notes"
                rows={3}
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Invoice reference, billing notes, etc."
                style={{ ...input, resize: "vertical" }}
              />
            </div>

            <button
              type="submit"
              disabled={saving || !selectedOrder}
              style={{
                ...primaryButton,
                marginTop: 18,
                opacity: saving || !selectedOrder ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Record Invoice"}
            </button>
          </form>
        </section>

        <section style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 7px", fontSize: 20 }}>
                Invoice Register
              </h2>

              <p style={{ color: C.muted, fontSize: 13 }}>
                Run matching before approval. Discrepancies require review.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              style={secondaryButton}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <p style={{ color: C.muted }}>Loading invoices...</p>
          ) : invoices.length === 0 ? (
            <p style={{ color: C.muted }}>
              No invoices yet. Record an invoice above to begin.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 900,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Invoice",
                      "Purchase Order",
                      "Vendor",
                      "Invoice Date",
                      "Amount",
                      "Status",
                      "Actions",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: "12px 10px",
                          textAlign: "left",
                          background: C.soft,
                          color: C.muted,
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {invoices.map((invoice) => {
                    const badge = statusStyle(invoice.status);
                    const busy = busyId === invoice._id;
                    const po = invoice.purchaseOrderId;

                    return (
                      <tr key={invoice._id}>
                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13,
                          }}
                        >
                          <strong>{invoice.invoiceNumber}</strong>
                          <p style={{ color: C.muted, fontSize: 11 }}>
                            Due: {dateLabel(invoice.dueDate)}
                          </p>
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13,
                          }}
                        >
                          {po?.poNumber || "—"}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13,
                          }}
                        >
                          {vendorName(invoice.vendorId)}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13,
                          }}
                        >
                          {dateLabel(invoice.invoiceDate)}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13,
                            fontWeight: 750,
                          }}
                        >
                          {money(invoice.totalAmount, invoice.currency)}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "6px 9px",
                              borderRadius: 20,
                              background: badge.background,
                              color: badge.color,
                              fontSize: 11,
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {statusLabel(invoice.status)}
                          </span>
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                              gap: 7,
                            }}
                          >
                            {["draft", "matched", "discrepancy"].includes(
                              invoice.status
                            ) && (
                              <button
                                type="button"
                                disabled={busy}
                                style={secondaryButton}
                                onClick={() => runMatching(invoice)}
                              >
                                {busy
                                  ? "Processing..."
                                  : "Run 3-Way Match"}
                              </button>
                            )}

                            {invoice.status === "matched" && (
                              <button
                                type="button"
                                disabled={busy}
                                style={primaryButton}
                                onClick={() => approveInvoice(invoice)}
                              >
                                Approve
                              </button>
                            )}

                            {["draft", "matched", "discrepancy"].includes(
                              invoice.status
                            ) && (
                              <button
                                type="button"
                                disabled={busy}
                                style={{
                                  ...secondaryButton,
                                  color: C.red,
                                }}
                                onClick={() => rejectInvoice(invoice)}
                              >
                                Reject
                              </button>
                            )}

                            {invoice.status === "approved" && (
                              <span
                                style={{
                                  fontSize: 12,
                                  color: C.green,
                                  fontWeight: 700,
                                }}
                              >
                                Ready for Phase 11
                              </span>
                            )}

                            {invoice.status === "discrepancy" &&
                              invoice.matchResult?.issues?.length > 0 && (
                                <details style={{ maxWidth: 250 }}>
                                  <summary
                                    style={{
                                      fontSize: 12,
                                      color: C.red,
                                      cursor: "pointer",
                                    }}
                                  >
                                    View discrepancies (
                                    {invoice.matchResult.issues.length})
                                  </summary>

                                  <ul
                                    style={{
                                      color: C.red,
                                      fontSize: 12,
                                      paddingLeft: 18,
                                      lineHeight: 1.6,
                                    }}
                                  >
                                    {invoice.matchResult.issues.map(
                                      (issue, index) => (
                                        <li key={`${index}-${issue}`}>
                                          {issue}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </details>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          style={{
            ...card,
            background: C.soft,
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: 16 }}>
            Invoice Value Overview
          </h3>

          <p style={{ color: C.muted, fontSize: 13 }}>
            Total non-rejected invoice value:
          </p>

          <p style={{ fontSize: 27, fontWeight: 850, marginBottom: 0 }}>
            {money(totalValue)}
          </p>

          <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
            This is a register total, not the amount due for payment.
            Approved invoices are handed off to the payment workflow
            in Phase 11.
          </p>
        </section>
      </div>
    </main>
  );
}

