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
  borderRadius: 15,
  padding: 21,
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

function label(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function vendorName(vendor) {
  if (!vendor) return "Unknown vendor";
  if (typeof vendor === "string") return vendor;

  return vendor.name || vendor.email || "Unknown vendor";
}

function badgeColors(status) {
  if (["paid", "completed", "approved"].includes(status)) {
    return { background: C.greenBg, color: C.green };
  }

  if (["overdue", "failed", "rejected"].includes(status)) {
    return { background: C.redBg, color: C.red };
  }

  if (["partially_paid", "pending"].includes(status)) {
    return { background: C.amberBg, color: C.amber };
  }

  return { background: C.soft, color: C.muted };
}

export default function FinancePage() {
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);

  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");

  // FIX: Initialize with an empty value to avoid new Date()
  // being evaluated during Client Component rendering.
  const [paymentDate, setPaymentDate] = useState("");

  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // FIX: Set the current local date after the component mounts.
  useEffect(() => {
    const now = new Date();

    const localDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    setPaymentDate(localDate);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [summaryResponse, paymentResponse] = await Promise.all([
        apiRequest("/payments/summary"),
        apiRequest("/payments"),
      ]);

      setSummary(summaryResponse.summary || {});
      setInvoices(summaryResponse.invoices || []);
      setPayments(paymentResponse.payments || []);
    } catch (err) {
      setError(err.message || "Could not load finance data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedInvoice = invoices.find(
    (invoice) => invoice._id === invoiceId
  );

  const numericAmount = Number(amount);

  const remainingAfterPayment = selectedInvoice
    ? Math.max(
        0,
        Number(selectedInvoice.outstandingAmount || 0) -
          (Number.isFinite(numericAmount) ? numericAmount : 0)
      )
    : 0;

  async function recordPayment(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!selectedInvoice) {
      setError("Select an invoice with an outstanding balance.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    if (numericAmount > selectedInvoice.outstandingAmount + 0.001) {
      setError("Payment amount cannot exceed the outstanding balance.");
      return;
    }

    if (!paymentDate) {
      setError("Select a payment date.");
      return;
    }

    setSaving(true);

    try {
      const response = await apiRequest("/payments", {
        method: "POST",
        body: {
          invoiceId,
          amount: numericAmount,
          paymentMethod,
          paymentReference,
          paymentDate,
          status: "completed",
          notes,
        },
      });

      setMessage(response.message || "Payment recorded successfully.");

      setInvoiceId("");
      setAmount("");
      setPaymentReference("");
      setNotes("");

      await loadData();
    } catch (err) {
      setError(err.message || "Could not record payment.");
    } finally {
      setSaving(false);
    }
  }

  async function updatePendingPayment(payment, status) {
    setError("");
    setMessage("");
    setBusyId(payment._id);

    try {
      const response = await apiRequest(
        `/payments/${payment._id}/status`,
        {
          method: "PATCH",
          body: {
            status,
            note: `Finance updated payment status to ${label(status)}.`,
          },
        }
      );

      setMessage(response.message || "Payment status updated.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not update payment status.");
    } finally {
      setBusyId("");
    }
  }

  const completedPayments = payments.filter(
    (payment) => payment.status === "completed"
  );

  const completedPaymentValue = completedPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
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
              FINANCE WORKSPACE
            </p>

            <h1
              style={{
                fontSize: 30,
                fontWeight: 850,
                margin: "0 0 8px",
              }}
            >
              Finance & Payments
            </h1>

            <p style={{ color: C.muted, fontSize: 14 }}>
              Track approved invoices, outstanding balances and supplier payments.
            </p>
          </div>

          <Link
            href="/invoices"
            style={{
              color: "#655A7C",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Invoice Management →
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
            ["Approved Invoice Value", summary?.invoiceValue],
            ["Total Paid", summary?.paidAmount],
            ["Outstanding", summary?.outstandingAmount],
            ["Overdue Invoices", summary?.overdueInvoices],
          ].map(([title, value]) => (
            <div key={title} style={card}>
              <p style={{ color: C.muted, fontSize: 13 }}>{title}</p>

              <p
                style={{
                  fontSize: 25,
                  fontWeight: 850,
                  margin: 0,
                  overflowWrap: "anywhere",
                }}
              >
                {title === "Overdue Invoices"
                  ? Number(value || 0)
                  : money(value)}
              </p>
            </div>
          ))}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
            marginBottom: 22,
          }}
        >
          <div style={card}>
            <p style={{ color: C.muted, fontSize: 13 }}>
              Fully Paid Invoices
            </p>
            <p style={{ fontSize: 25, fontWeight: 850, margin: 0 }}>
              {summary?.paidInvoices || 0}
            </p>
          </div>

          <div style={card}>
            <p style={{ color: C.muted, fontSize: 13 }}>
              Partially Paid Invoices
            </p>
            <p style={{ fontSize: 25, fontWeight: 850, margin: 0 }}>
              {summary?.partiallyPaidInvoices || 0}
            </p>
          </div>

          <div style={card}>
            <p style={{ color: C.muted, fontSize: 13 }}>
              Unpaid Invoices
            </p>
            <p style={{ fontSize: 25, fontWeight: 850, margin: 0 }}>
              {summary?.unpaidInvoices || 0}
            </p>
          </div>
        </section>

        <section style={{ ...card, marginBottom: 22 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 0 }}>
            Record Supplier Payment
          </h2>

          <p
            style={{
              color: C.muted,
              fontSize: 13,
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            Only approved invoices with an outstanding balance are available.
            You can record full or partial payments.
          </p>

          <form onSubmit={recordPayment}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <div>
                <label
                  htmlFor="invoice"
                  style={{
                    display: "block",
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 7,
                  }}
                >
                  Approved Invoice *
                </label>

                <select
                  id="invoice"
                  required
                  value={invoiceId}
                  onChange={(event) => {
                    setInvoiceId(event.target.value);
                    setAmount("");
                  }}
                  style={input}
                >
                  <option value="">Select invoice</option>

                  {invoices
                    .filter(
                      (invoice) =>
                        Number(invoice.outstandingAmount) > 0
                    )
                    .map((invoice) => (
                      <option key={invoice._id} value={invoice._id}>
                        {invoice.invoiceNumber} —{" "}
                        {vendorName(invoice.vendorId)} — Due{" "}
                        {money(
                          invoice.outstandingAmount,
                          invoice.currency
                        )}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="amount"
                  style={{
                    display: "block",
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 7,
                  }}
                >
                  Payment Amount *
                </label>

                <input
                  id="amount"
                  type="number"
                  min="0.01"
                  max={selectedInvoice?.outstandingAmount || undefined}
                  step="0.01"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Enter amount"
                  style={input}
                />
              </div>

              <div>
                <label
                  htmlFor="method"
                  style={{
                    display: "block",
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 7,
                  }}
                >
                  Payment Method *
                </label>

                <select
                  id="method"
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value)
                  }
                  style={input}
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="paymentDate"
                  style={{
                    display: "block",
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 7,
                  }}
                >
                  Payment Date *
                </label>

                <input
                  id="paymentDate"
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                  style={input}
                />
              </div>

              <div>
                <label
                  htmlFor="reference"
                  style={{
                    display: "block",
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 7,
                  }}
                >
                  Transaction Reference
                </label>

                <input
                  id="reference"
                  maxLength={150}
                  value={paymentReference}
                  onChange={(event) =>
                    setPaymentReference(event.target.value)
                  }
                  placeholder="UTR / transaction / cheque number"
                  style={input}
                />
              </div>
            </div>

            {selectedInvoice && (
              <div
                style={{
                  background: C.soft,
                  border: `1px solid ${C.border}`,
                  borderRadius: 11,
                  padding: 15,
                  marginTop: 18,
                }}
              >
                <p style={{ margin: "0 0 8px", fontWeight: 800 }}>
                  Invoice Balance
                </p>

                <p style={{ color: C.muted, fontSize: 13 }}>
                  Invoice total:{" "}
                  {money(
                    selectedInvoice.totalAmount,
                    selectedInvoice.currency
                  )}
                </p>

                <p style={{ color: C.muted, fontSize: 13 }}>
                  Already paid:{" "}
                  {money(
                    selectedInvoice.paidAmount,
                    selectedInvoice.currency
                  )}
                </p>

                <p style={{ color: C.muted, fontSize: 13 }}>
                  Outstanding before payment:{" "}
                  {money(
                    selectedInvoice.outstandingAmount,
                    selectedInvoice.currency
                  )}
                </p>

                <p style={{ fontSize: 14, fontWeight: 800 }}>
                  Remaining after this payment:{" "}
                  {money(
                    remainingAfterPayment,
                    selectedInvoice.currency
                  )}
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
                Payment Notes
              </label>

              <textarea
                id="notes"
                rows={3}
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional payment notes..."
                style={{ ...input, resize: "vertical" }}
              />
            </div>

            <button
              type="submit"
              disabled={saving || !selectedInvoice || !paymentDate}
              style={{
                ...primaryButton,
                marginTop: 18,
                opacity:
                  saving || !selectedInvoice || !paymentDate ? 0.6 : 1,
              }}
            >
              {saving ? "Recording..." : "Record Completed Payment"}
            </button>
          </form>
        </section>

        <section style={{ ...card, marginBottom: 22 }}>
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
                Approved Invoice Register
              </h2>

              <p style={{ color: C.muted, fontSize: 13 }}>
                Invoice-level outstanding and payment status.
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
            <p style={{ color: C.muted }}>Loading finance data...</p>
          ) : invoices.length === 0 ? (
            <p style={{ color: C.muted }}>
              No approved invoices are available. Approve a matched invoice
              in Invoice Management first.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 850,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Invoice",
                      "Vendor",
                      "Due Date",
                      "Invoice Total",
                      "Paid",
                      "Outstanding",
                      "Status",
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
                    const badge = badgeColors(invoice.paymentStatus);

                    return (
                      <tr key={invoice._id}>
                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13,
                            fontWeight: 750,
                          }}
                        >
                          {invoice.invoiceNumber}
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
                          {dateLabel(invoice.dueDate)}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13,
                          }}
                        >
                          {money(invoice.totalAmount, invoice.currency)}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13,
                          }}
                        >
                          {money(invoice.paidAmount, invoice.currency)}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13,
                            fontWeight: 750,
                          }}
                        >
                          {money(
                            invoice.outstandingAmount,
                            invoice.currency
                          )}
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
                            }}
                          >
                            {label(invoice.paymentStatus)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>
            Payment History
          </h2>

          <p style={{ color: C.muted, fontSize: 13 }}>
            Completed payment value: {money(completedPaymentValue)}
          </p>

          {loading ? (
            <p style={{ color: C.muted }}>Loading payments...</p>
          ) : payments.length === 0 ? (
            <p style={{ color: C.muted }}>
              No payment records yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 800,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Payment Number",
                      "Invoice",
                      "Vendor",
                      "Date",
                      "Amount",
                      "Method",
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
                  {payments.map((payment) => {
                    const badge = badgeColors(payment.status);
                    const busy = busyId === payment._id;

                    return (
                      <tr key={payment._id}>
                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 12,
                            fontWeight: 750,
                          }}
                        >
                          {payment.paymentNumber}
                          {payment.paymentReference && (
                            <p
                              style={{
                                color: C.muted,
                                fontSize: 11,
                                fontWeight: 400,
                              }}
                            >
                              Ref: {payment.paymentReference}
                            </p>
                          )}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13,
                          }}
                        >
                          {payment.invoiceId?.invoiceNumber || "—"}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13,
                          }}
                        >
                          {vendorName(payment.vendorId)}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13,
                          }}
                        >
                          {dateLabel(payment.paymentDate)}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 13,
                            fontWeight: 750,
                          }}
                        >
                          {money(payment.amount, payment.currency)}
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: 12,
                          }}
                        >
                          {label(payment.paymentMethod)}
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
                            }}
                          >
                            {label(payment.status)}
                          </span>
                        </td>

                        <td
                          style={{
                            padding: 12,
                            borderBottom: `1px solid ${C.border}`,
                          }}
                        >
                          {payment.status === "pending" ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 7,
                                alignItems: "flex-start",
                              }}
                            >
                              <button
                                type="button"
                                disabled={busy}
                                style={secondaryButton}
                                onClick={() =>
                                  updatePendingPayment(payment, "completed")
                                }
                              >
                                {busy ? "Updating..." : "Mark Completed"}
                              </button>

                              <button
                                type="button"
                                disabled={busy}
                                style={{
                                  ...secondaryButton,
                                  color: C.red,
                                }}
                                onClick={() => {
                                  const confirmed = window.confirm(
                                    `Mark ${payment.paymentNumber} as failed?`
                                  );

                                  if (confirmed) {
                                    updatePendingPayment(payment, "failed");
                                  }
                                }}
                              >
                                Mark Failed
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: C.muted, fontSize: 12 }}>
                              No action
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}