"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const inputClass =
  "w-full rounded-xl border border-[#e3dfeb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#8D7BB8] focus:ring-2 focus:ring-[#8D7BB8]/15";

const PAYMENT_TERMS = [
  ["immediate", "Immediate"],
  ["net_15", "Net 15 days"],
  ["net_30", "Net 30 days"],
  ["net_45", "Net 45 days"],
  ["net_60", "Net 60 days"],
];

function money(value, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateTimeLocal(date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export default function RFQPage() {
  const router = useRouter();

  const [rfqs, setRfqs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [purchaseRequestId, setPurchaseRequestId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [minimumDateTime, setMinimumDateTime] = useState("");
  const [terms, setTerms] = useState("");
  const [vendorIds, setVendorIds] = useState([]);

  const [activeRFQ, setActiveRFQ] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [quoteVendorId, setQuoteVendorId] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [quotePrices, setQuotePrices] = useState([]);
  const [quoteTaxRates, setQuoteTaxRates] = useState([]);
  const [quoteDeliveryDays, setQuoteDeliveryDays] = useState("7");
  const [quoteValidUntil, setQuoteValidUntil] = useState("");
  const [quotePaymentTerms, setQuotePaymentTerms] = useState("net_30");
  const [quoteNotes, setQuoteNotes] = useState("");

  useEffect(() => {
    const now = new Date();

    const minimum = new Date(now.getTime() + 60 * 1000);
    const defaultDeadline = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000
    );
    const defaultValidity = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    setMinimumDateTime(dateTimeLocal(minimum));
    setDeadline(dateTimeLocal(defaultDeadline));
    setQuoteValidUntil(dateTimeLocal(defaultValidity));
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [rfqResult, requestResult, vendorResult] = await Promise.all([
        apiRequest("/rfqs"),
        apiRequest("/purchase-requests"),
        apiRequest("/vendors?status=active"),
      ]);

      setRfqs(rfqResult.rfqs || []);

      const allRequests =
        requestResult.requests ||
        requestResult.purchaseRequests ||
        [];

      setRequests(allRequests.filter((r) => r.status === "approved"));
      setVendors(vendorResult.vendors || []);
    } catch (err) {
      if (err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(
        err.message ||
          "Unable to load RFQs. Check your permissions and API routes."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = sessionStorage.getItem("procureflow_token");
    const rawUser = sessionStorage.getItem("procureflow_user");

    if (!token || !rawUser) {
      router.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(rawUser);

      if (!["company_admin", "procurement_manager"].includes(user.role)) {
        router.replace("/dashboard");
        return;
      }

      loadAll();
    } catch {
      router.replace("/login");
    }
  }, [router, loadAll]);

  function resetCreateForm() {
    setPurchaseRequestId("");
    setTitle("");
    setDescription("");
    setDeadline(
      dateTimeLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    );
    setTerms("");
    setVendorIds([]);
  }

  function toggleVendor(id) {
    setVendorIds((old) =>
      old.includes(id)
        ? old.filter((vendorId) => vendorId !== id)
        : [...old, id]
    );
  }

  async function createRFQ(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await apiRequest("/rfqs", {
        method: "POST",
        body: JSON.stringify({
          purchaseRequestId,
          title,
          description,
          deadline: new Date(deadline).toISOString(),
          terms,
          vendorIds,
        }),
      });

      setNotice(result.message || "RFQ draft created.");
      setShowCreate(false);
      resetCreateForm();
      await loadAll();
    } catch (err) {
      setError(err.message || "Could not create RFQ.");
    } finally {
      setSaving(false);
    }
  }

  async function changeRFQStatus(rfq, status) {
    setError("");
    setNotice("");

    try {
      const result = await apiRequest(`/rfqs/${rfq._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setNotice(result.message || `RFQ ${status}.`);
      await loadAll();
    } catch (err) {
      setError(err.message || "Could not update RFQ status.");
    }
  }

  async function openComparison(rfq) {
    setError("");
    setNotice("");
    setActiveRFQ(rfq);
    setQuotes([]);

    try {
      const result = await apiRequest(`/rfqs/${rfq._id}/compare`);
      setQuotes(result.quotations || []);
    } catch (err) {
      setError(err.message || "Could not load quotation comparison.");
    }
  }

  function startQuoteForm(rfq) {
    if (rfq.status !== "published") {
      setError("Publish the RFQ before recording quotations.");
      return;
    }

    const invited = (rfq.vendorIds || []).filter(
      (vendor) => vendor && vendor._id
    );

    const quotedIds = new Set(
      quotes.map((quote) => String(quote.vendor?._id || ""))
    );

    const eligible = invited.filter(
      (vendor) =>
        vendor.status === "active" &&
        !quotedIds.has(String(vendor._id))
    );

    if (eligible.length === 0) {
      setError("No invited active vendor remains without a recorded quote.");
      return;
    }

    setQuoteVendorId(eligible[0]._id);
    setQuoteNumber("");
    setQuotePrices((rfq.items || []).map(() => ""));
    setQuoteTaxRates((rfq.items || []).map(() => "0"));
    setQuoteDeliveryDays("7");
    setQuoteValidUntil(
      dateTimeLocal(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
    );
    setQuotePaymentTerms("net_30");
    setQuoteNotes("");
    setError("");
    setNotice("");
  }

  async function submitQuotation(event) {
    event.preventDefault();

    if (!activeRFQ) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const items = activeRFQ.items.map((item, index) => ({
        quantity: item.quantity,
        unitPrice: Number(quotePrices[index]),
        taxRate: Number(quoteTaxRates[index] || 0),
      }));

      const result = await apiRequest(
        `/rfqs/${activeRFQ._id}/quotations`,
        {
          method: "POST",
          body: JSON.stringify({
            vendorId: quoteVendorId,
            quotationNumber: quoteNumber,
            items,
            deliveryDays: Number(quoteDeliveryDays),
            validUntil: new Date(quoteValidUntil).toISOString(),
            paymentTerms: quotePaymentTerms,
            currency: "INR",
            notes: quoteNotes,
          }),
        }
      );

      setNotice(result.message || "Quotation recorded.");
      await openComparison(activeRFQ);
      await loadAll();
    } catch (err) {
      setError(err.message || "Could not record quotation.");
    } finally {
      setSaving(false);
    }
  }

  const invitedVendors = (activeRFQ?.vendorIds || []).filter(
    (vendor) => vendor && vendor._id
  );

  const alreadyQuoted = new Set(
    quotes.map((quote) => String(quote.vendor?._id || ""))
  );

  const availableVendors = invitedVendors.filter(
    (vendor) =>
      vendor.status === "active" &&
      !alreadyQuoted.has(String(vendor._id))
  );

  const totalPreview = activeRFQ
    ? activeRFQ.items.reduce((sum, item, index) => {
        const quantity = Number(item.quantity || 0);
        const price = Number(quotePrices[index] || 0);
        const tax = Number(quoteTaxRates[index] || 0);
        return sum + quantity * price * (1 + tax / 100);
      }, 0)
    : 0;

  return (
    <main className="min-h-screen bg-[#F7F5F1] px-4 py-6 text-[#242333] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8D7BB8]">
              ProcureFlow / Procurement
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              RFQ & Quotations
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#777382]">
              Request supplier pricing, record offers and compare costs and
              delivery timelines.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowCreate((old) => !old);
              setError("");
            }}
            className="rounded-xl bg-[#242333] px-5 py-3 text-sm font-semibold text-white hover:bg-[#39364c]"
          >
            + Create RFQ
          </button>
        </header>

        {notice && (
          <div
            role="status"
            className="rounded-xl border border-[#c9dfcf] bg-[#edf7ef] px-4 py-3 text-sm text-[#245b34]"
          >
            {notice}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {showCreate && (
          <section className="rounded-2xl border border-[#e9e5ef] bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-bold">Create request for quotation</h2>
            <p className="mt-1 text-sm text-[#777382]">
              Only approved purchase requests can be used.
            </p>

            <form onSubmit={createRFQ} className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">
                    Approved purchase request *
                  </span>
                  <select
                    className={inputClass}
                    required
                    value={purchaseRequestId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setPurchaseRequestId(id);
                      const request = requests.find((r) => r._id === id);
                      if (request && !title) {
                        setTitle(`Quotation for ${request.title}`);
                      }
                    }}
                  >
                    <option value="">Select purchase request</option>
                    {requests.map((request) => (
                      <option key={request._id} value={request._id}>
                        {request.requestNumber || "PR"} — {request.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium">RFQ title *</span>
                  <input
                    className={inputClass}
                    required
                    minLength={3}
                    maxLength={150}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Office equipment quotation"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium">
                    Submission deadline *
                  </span>
                  <input
                    className={inputClass}
                    type="datetime-local"
                    required
                    min={minimumDateTime || undefined}
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Description</span>
                <textarea
                  className={inputClass}
                  rows={2}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide context for the quotation request"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Commercial terms</span>
                <textarea
                  className={inputClass}
                  rows={3}
                  maxLength={5000}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Delivery expectations, warranty, quotation requirements..."
                />
              </label>

              <div>
                <h3 className="mb-3 font-semibold">Invite vendors *</h3>
                {vendors.length === 0 ? (
                  <p className="rounded-xl bg-[#faf9fc] p-4 text-sm text-[#777382]">
                    No active vendors found. Add vendors in Vendor Management
                    first.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {vendors.map((vendor) => (
                      <label
                        key={vendor._id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                          vendorIds.includes(vendor._id)
                            ? "border-[#8D7BB8] bg-[#f5f1fb]"
                            : "border-[#e9e5ef] bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={vendorIds.includes(vendor._id)}
                          onChange={() => toggleVendor(vendor._id)}
                          className="mt-1 accent-[#8D7BB8]"
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold">
                            {vendor.name}
                          </span>
                          <span className="mt-1 block break-all text-xs text-[#777382]">
                            {vendor.email}
                          </span>
                          <span className="mt-1 block text-xs text-[#777382]">
                            {vendor.category}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-[#777382]">
                  Selected: {vendorIds.length} vendor(s)
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving || vendorIds.length === 0}
                  className="rounded-xl bg-[#8D7BB8] px-6 py-3 text-sm font-semibold text-white hover:bg-[#7765a4] disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Create RFQ draft"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl border border-[#e3dfeb] px-6 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-[#e9e5ef] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#eeeaf3] p-5">
            <div>
              <h2 className="text-lg font-bold">RFQ register</h2>
              <p className="mt-1 text-sm text-[#777382]">
                Review requests and manage their lifecycle.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAll}
              className="rounded-xl border border-[#e3dfeb] px-4 py-2 text-sm font-semibold hover:bg-[#f8f6fb]"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-[#777382]">
              Loading RFQs...
            </div>
          ) : rfqs.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#777382]">
              No RFQs yet. Create an RFQ from an approved purchase request.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#faf9fc] text-xs uppercase tracking-wide text-[#777382]">
                  <tr>
                    <th className="px-5 py-4">RFQ</th>
                    <th className="px-5 py-4">Purchase request</th>
                    <th className="px-5 py-4">Vendors</th>
                    <th className="px-5 py-4">Deadline</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0edf4]">
                  {rfqs.map((rfq) => (
                    <tr key={rfq._id} className="hover:bg-[#fcfbfe]">
                      <td className="px-5 py-4">
                        <p className="font-semibold">{rfq.rfqNumber}</p>
                        <p className="mt-1 text-xs text-[#777382]">
                          {rfq.title}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {rfq.purchaseRequestId?.requestNumber || "—"}
                        <p className="mt-1 text-xs text-[#777382]">
                          {rfq.purchaseRequestId?.title || ""}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p>{(rfq.vendorIds || []).length} invited</p>
                        <p className="mt-1 text-xs text-[#777382]">
                          {rfq.quotationCount || 0} quotation(s)
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {new Date(rfq.deadline).toLocaleString()}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#f0edf4] px-3 py-1 text-xs font-semibold capitalize">
                          {rfq.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => openComparison(rfq)}
                            className="font-semibold text-[#7765a4] hover:underline"
                          >
                            Compare
                          </button>
                          {rfq.status === "draft" && (
                            <button
                              type="button"
                              onClick={() =>
                                changeRFQStatus(rfq, "published")
                              }
                              className="font-semibold hover:underline"
                            >
                              Publish
                            </button>
                          )}
                          {rfq.status === "published" && (
                            <button
                              type="button"
                              onClick={() => changeRFQStatus(rfq, "closed")}
                              className="font-semibold hover:underline"
                            >
                              Close
                            </button>
                          )}
                          {["draft", "published"].includes(rfq.status) && (
                            <button
                              type="button"
                              onClick={() =>
                                changeRFQStatus(rfq, "cancelled")
                              }
                              className="font-semibold text-red-600 hover:underline"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {activeRFQ && (
          <section className="space-y-5 rounded-2xl border border-[#e9e5ef] bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8D7BB8]">
                  Quotation comparison
                </p>
                <h2 className="mt-2 text-xl font-bold">{activeRFQ.title}</h2>
                <p className="mt-1 text-sm text-[#777382]">
                  {activeRFQ.rfqNumber} · {quotes.length} recorded quotation(s)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeRFQ.status === "published" && (
                  <button
                    type="button"
                    onClick={() => startQuoteForm(activeRFQ)}
                    className="rounded-xl bg-[#8D7BB8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7765a4]"
                  >
                    + Record quotation
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveRFQ(null);
                    setQuotes([]);
                  }}
                  className="rounded-xl border border-[#e3dfeb] px-4 py-2.5 text-sm font-semibold"
                >
                  Close
                </button>
              </div>
            </div>

            {quotes.length === 0 ? (
              <p className="rounded-xl bg-[#faf9fc] p-5 text-sm text-[#777382]">
                No quotations recorded yet. Publish the RFQ and use “Record
                quotation”.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-left text-sm">
                  <thead className="bg-[#faf9fc] text-xs uppercase text-[#777382]">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3">Subtotal</th>
                      <th className="px-4 py-3">Tax</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Delivery</th>
                      <th className="px-4 py-3">Valid until</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0edf4]">
                    {quotes.map((quote) => (
                      <tr
                        key={quote.quotationId}
                        className={quote.isLowestPrice ? "bg-[#f5f1fb]" : ""}
                      >
                        <td className="px-4 py-4 font-semibold">
                          #{quote.rank}
                          {quote.isLowestPrice && (
                            <span className="mt-1 block text-xs font-normal text-[#7765a4]">
                              Lowest price
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold">{quote.vendor?.name}</p>
                          <p className="mt-1 text-xs text-[#777382]">
                            {quote.quotationNumber || "No reference"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {money(quote.subtotal, quote.currency)}
                        </td>
                        <td className="px-4 py-4">
                          {money(quote.taxAmount, quote.currency)}
                        </td>
                        <td className="px-4 py-4 font-bold">
                          {money(quote.totalAmount, quote.currency)}
                        </td>
                        <td className="px-4 py-4">
                          {quote.deliveryDays} days
                        </td>
                        <td className="px-4 py-4">
                          {new Date(quote.validUntil).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeRFQ.status === "published" &&
              availableVendors.length > 0 &&
              quotePrices.length > 0 && (
                <form
                  onSubmit={submitQuotation}
                  className="space-y-5 border-t border-[#eeeaf3] pt-6"
                >
                  <h3 className="text-lg font-bold">
                    Record vendor quotation
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="space-y-1.5">
                      <span className="text-sm font-medium">
                        Invited vendor *
                      </span>
                      <select
                        className={inputClass}
                        required
                        value={quoteVendorId}
                        onChange={(e) => setQuoteVendorId(e.target.value)}
                      >
                        {availableVendors.map((vendor) => (
                          <option key={vendor._id} value={vendor._id}>
                            {vendor.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-medium">
                        Vendor quotation number
                      </span>
                      <input
                        className={inputClass}
                        maxLength={100}
                        value={quoteNumber}
                        onChange={(e) => setQuoteNumber(e.target.value)}
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-medium">
                        Delivery days *
                      </span>
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={quoteDeliveryDays}
                        onChange={(e) =>
                          setQuoteDeliveryDays(e.target.value)
                        }
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-medium">
                        Quotation valid until *
                      </span>
                      <input
                        className={inputClass}
                        type="datetime-local"
                        required
                        min={minimumDateTime || undefined}
                        value={quoteValidUntil}
                        onChange={(e) =>
                          setQuoteValidUntil(e.target.value)
                        }
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-medium">
                        Payment terms *
                      </span>
                      <select
                        className={inputClass}
                        value={quotePaymentTerms}
                        onChange={(e) =>
                          setQuotePaymentTerms(e.target.value)
                        }
                      >
                        {PAYMENT_TERMS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div>
                    <h4 className="mb-3 font-semibold">Item pricing</h4>
                    <div className="space-y-3">
                      {activeRFQ.items.map((item, index) => (
                        <div
                          key={`${item.name}-${index}`}
                          className="grid gap-3 rounded-xl border border-[#e9e5ef] p-4 sm:grid-cols-4"
                        >
                          <div className="sm:col-span-2">
                            <p className="font-semibold">{item.name}</p>
                            <p className="mt-1 text-xs text-[#777382]">
                              Quantity: {item.quantity} {item.unit}
                            </p>
                          </div>

                          <label className="space-y-1">
                            <span className="text-xs text-[#777382]">
                              Unit price (INR) *
                            </span>
                            <input
                              className={inputClass}
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={quotePrices[index] ?? ""}
                              onChange={(e) =>
                                setQuotePrices((old) =>
                                  old.map((value, i) =>
                                    i === index ? e.target.value : value
                                  )
                                )
                              }
                            />
                          </label>

                          <label className="space-y-1">
                            <span className="text-xs text-[#777382]">
                              Tax %
                            </span>
                            <input
                              className={inputClass}
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={quoteTaxRates[index] ?? "0"}
                              onChange={(e) =>
                                setQuoteTaxRates((old) =>
                                  old.map((value, i) =>
                                    i === index ? e.target.value : value
                                  )
                                )
                              }
                            />
                          </label>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-xl bg-[#f5f1fb] p-4 text-right">
                      <p className="text-sm text-[#777382]">
                        Estimated quote total (including tax)
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {money(totalPreview)}
                      </p>
                    </div>
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">
                      Quotation notes
                    </span>
                    <textarea
                      className={inputClass}
                      rows={2}
                      maxLength={2000}
                      value={quoteNotes}
                      onChange={(e) => setQuoteNotes(e.target.value)}
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={saving || !quoteVendorId}
                    className="rounded-xl bg-[#242333] px-6 py-3 text-sm font-semibold text-white hover:bg-[#39364c] disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save quotation"}
                  </button>
                </form>
              )}
          </section>
        )}
      </div>
    </main>
  );
}
