
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const eligibleStatuses = [
  "issued",
  "acknowledged",
  "partially_received",
];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function getId(value) {
  return String(value?._id || value?.id || value || "");
}

function emptyLine(index, item) {
  return {
    itemIndex: index,
    receivedQuantity: "",
    acceptedQuantity: "",
    damagedQuantity: "0",
    rejectedQuantity: "0",
    conditionNotes: "",
    name: item.name,
    orderedQuantity: Number(item.quantity || 0),
  };
}

export default function GoodsReceiptsPage() {
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [lines, setLines] = useState([]);
  const [receivedAt, setReceivedAt] = useState("");

useEffect(() => {
  const today = new Date();
  const localDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  setReceivedAt(localDate);
}, []);
  const [deliveryReference, setDeliveryReference] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [orderResult, receiptResult] = await Promise.all([
        apiRequest("/purchase-orders"),
        apiRequest("/goods-receipts"),
      ]);

      setOrders(orderResult.purchaseOrders || []);
      setReceipts(receiptResult.goodsReceipts || []);
    } catch (err) {
      if (err.status === 401) {
        router.replace("/");
        return;
      }

      setError(err.message || "Could not load delivery records.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedOrder = orders.find(
    (order) => getId(order) === selectedOrderId
  );

  function selectOrder(id) {
    setSelectedOrderId(id);
    setError("");
    setMessage("");

    const order = orders.find((item) => getId(item) === id);

    if (!order) {
      setLines([]);
      return;
    }

    setLines(
      (order.items || []).map((item, index) => emptyLine(index, item))
    );
  }

  function updateLine(index, field, value) {
    setLines((current) =>
      current.map((line) =>
        line.itemIndex === index
          ? { ...line, [field]: value }
          : line
      )
    );
  }

  function handleReceivedChange(line, value) {
    const received = Number(value);
    const safeReceived = value === "" ? "" : value;

    setLines((current) =>
      current.map((item) => {
        if (item.itemIndex !== line.itemIndex) return item;

        const damaged = Number(item.damagedQuantity || 0);
        const rejected = Number(item.rejectedQuantity || 0);

        const accepted =
          value === ""
            ? ""
            : Math.max(0, received - damaged - rejected);

        return {
          ...item,
          receivedQuantity: safeReceived,
          acceptedQuantity: accepted === "" ? "" : String(accepted),
        };
      })
    );
  }

  function handleOtherQuantityChange(line, field, value) {
    setLines((current) =>
      current.map((item) => {
        if (item.itemIndex !== line.itemIndex) return item;

        const received = Number(item.receivedQuantity || 0);
        const damaged =
          field === "damagedQuantity"
            ? Number(value || 0)
            : Number(item.damagedQuantity || 0);
        const rejected =
          field === "rejectedQuantity"
            ? Number(value || 0)
            : Number(item.rejectedQuantity || 0);

        const accepted = Math.max(0, received - damaged - rejected);

        return {
          ...item,
          [field]: value,
          acceptedQuantity:
            item.receivedQuantity === "" ? "" : String(accepted),
        };
      })
    );
  }

  async function submitReceipt(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!selectedOrder) {
      setError("Please select a purchase order.");
      return;
    }

    const submittedLines = lines
      .filter((line) => Number(line.receivedQuantity) > 0)
      .map((line) => ({
        itemIndex: line.itemIndex,
        receivedQuantity: Number(line.receivedQuantity),
        acceptedQuantity: Number(line.acceptedQuantity),
        damagedQuantity: Number(line.damagedQuantity || 0),
        rejectedQuantity: Number(line.rejectedQuantity || 0),
        conditionNotes: line.conditionNotes.trim(),
      }));

    if (submittedLines.length === 0) {
      setError("Enter a received quantity for at least one item.");
      return;
    }

    for (const line of submittedLines) {
      const sum =
        line.acceptedQuantity +
        line.damagedQuantity +
        line.rejectedQuantity;

      if (
        line.receivedQuantity <= 0 ||
        line.acceptedQuantity < 0 ||
        line.damagedQuantity < 0 ||
        line.rejectedQuantity < 0 ||
        Math.abs(sum - line.receivedQuantity) > 0.0001
      ) {
        setError(
          "For every delivered item, accepted + damaged + rejected must equal received quantity."
        );
        return;
      }
    }

    setSaving(true);

    try {
      const result = await apiRequest("/goods-receipts", {
        method: "POST",
        body: JSON.stringify({
          purchaseOrderId: selectedOrderId,
          receivedAt,
          deliveryReference: deliveryReference.trim(),
          notes: notes.trim(),
          items: submittedLines,
        }),
      });

      setMessage(
        `${result.message || "Goods receipt recorded."} ${
          result.goodsReceipt?.grnNumber || ""
        }`
      );

      setSelectedOrderId("");
      setLines([]);
      setDeliveryReference("");
      setNotes("");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not save the goods receipt.");
    } finally {
      setSaving(false);
    }
  }

  const eligibleOrders = orders.filter((order) =>
    eligibleStatuses.includes(order.status)
  );

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F5F1] text-[#242333]">
        Loading delivery records...
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
              Delivery & Goods Receipt
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/purchase-orders"
              className="rounded-xl border border-[#d9d0e9] px-4 py-2.5 text-sm font-semibold hover:bg-[#E9E5F2]"
            >
              Purchase Orders
            </Link>

            <button
              type="button"
              onClick={loadData}
              className="rounded-xl bg-[#242333] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Refresh
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
            Delivery & GRN
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            Record partial or complete deliveries, inspect received goods
            and maintain a traceable goods receipt history.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {message}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            title="Eligible purchase orders"
            value={eligibleOrders.length}
            description="Orders awaiting delivery"
          />
          <SummaryCard
            title="Goods receipts recorded"
            value={receipts.length}
            description="Saved GRN records"
          />
          <SummaryCard
            title="Orders fully received"
            value={orders.filter((order) => order.status === "received").length}
            description="POs marked received"
          />
        </section>

        <section className="mt-8 rounded-2xl border border-[#e6e1da] bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold">Record a delivery</h2>
          <p className="mt-2 text-sm text-gray-600">
            Select an issued purchase order and enter quantities for the
            items delivered in this shipment.
          </p>

          <form onSubmit={submitReceipt} className="mt-6 space-y-6">
            <div>
              <label htmlFor="po" className="mb-2 block text-sm font-semibold">
                Purchase order
              </label>
              <select
                id="po"
                value={selectedOrderId}
                onChange={(event) => selectOrder(event.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#8D7BB8]"
              >
                <option value="">Select a purchase order</option>
                {eligibleOrders.map((order) => (
                  <option key={order._id} value={order._id}>
                    {order.poNumber} — {order.vendorId?.name || "Vendor"} — {order.status}
                  </option>
                ))}
              </select>

              {eligibleOrders.length === 0 && (
                <p className="mt-2 text-sm text-amber-700">
                  No issued or in-progress purchase orders are available.
                </p>
              )}
            </div>

            {selectedOrder && (
              <div className="rounded-xl bg-[#F7F5F1] p-4 text-sm">
                <p><strong>Vendor:</strong> {selectedOrder.vendorId?.name || "Vendor"}</p>
                <p className="mt-1"><strong>PO number:</strong> {selectedOrder.poNumber}</p>
                <p className="mt-1"><strong>Status:</strong> {selectedOrder.status.replaceAll("_", " ")}</p>
              </div>
            )}

            {lines.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Delivered items</h3>

                {lines.map((line) => (
                  <div key={line.itemIndex} className="rounded-xl border border-[#e6e1da] p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <h4 className="font-semibold">{line.name}</h4>
                      <p className="text-sm text-gray-500">
                        Ordered: {line.orderedQuantity}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <QuantityField
                        label="Received quantity"
                        value={line.receivedQuantity}
                        onChange={(value) => handleReceivedChange(line, value)}
                        max={line.orderedQuantity}
                      />
                      <QuantityField
                        label="Accepted quantity"
                        value={line.acceptedQuantity}
                        onChange={(value) => handleOtherQuantityChange(line, "acceptedQuantity", value)}
                        max={Number(line.receivedQuantity || 0)}
                      />
                      <QuantityField
                        label="Damaged quantity"
                        value={line.damagedQuantity}
                        onChange={(value) => handleOtherQuantityChange(line, "damagedQuantity", value)}
                        max={Number(line.receivedQuantity || 0)}
                      />
                      <QuantityField
                        label="Rejected quantity"
                        value={line.rejectedQuantity}
                        onChange={(value) => handleOtherQuantityChange(line, "rejectedQuantity", value)}
                        max={Number(line.receivedQuantity || 0)}
                      />
                    </div>

                    <label className="mt-4 block text-sm font-medium">
                      Condition notes
                      <input
                        value={line.conditionNotes}
                        onChange={(event) =>
                          updateLine(line.itemIndex, "conditionNotes", event.target.value)
                        }
                        maxLength={1000}
                        placeholder="Damage details or inspection notes"
                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8D7BB8]"
                      />
                    </label>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Receipt date
                <input
                  type="date"
                  value={receivedAt}
                  onChange={(event) => setReceivedAt(event.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  required
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8D7BB8]"
                />
              </label>

              <label className="block text-sm font-semibold">
                Delivery / challan reference
                <input
                  value={deliveryReference}
                  onChange={(event) => setDeliveryReference(event.target.value)}
                  maxLength={200}
                  placeholder="Optional delivery reference"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8D7BB8]"
                />
              </label>
            </div>

            <label className="block text-sm font-semibold">
              General notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Additional delivery or inspection details"
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#8D7BB8]"
              />
            </label>

            <button
              type="submit"
              disabled={saving || !selectedOrder}
              className="rounded-xl bg-[#242333] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving GRN..." : "Save Goods Receipt"}
            </button>
          </form>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-bold">Recent goods receipts</h2>
          <p className="mt-2 text-sm text-gray-600">
            History of deliveries recorded in your organisation.
          </p>

          {receipts.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#d9d0e9] bg-white p-8 text-center text-sm text-gray-600">
              No goods receipts have been recorded yet.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {receipts.map((receipt) => (
                <article key={receipt._id} className="rounded-2xl border border-[#e6e1da] bg-white p-5">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{receipt.grnNumber}</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        PO: {receipt.purchaseOrderId?.poNumber || "—"}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        Vendor: {receipt.vendorId?.name || "—"}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(receipt.receivedAt)}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                    {(receipt.items || []).map((item, index) => (
                      <div key={`${receipt._id}-${index}`} className="flex flex-wrap justify-between gap-2 text-sm">
                        <span>{item.itemName}</span>
                        <span className="text-gray-600">
                          Received {item.receivedQuantity} · Accepted {item.acceptedQuantity} · Damaged {item.damagedQuantity} · Rejected {item.rejectedQuantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {receipt.deliveryReference && (
                    <p className="mt-3 text-sm text-gray-500">
                      Reference: {receipt.deliveryReference}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
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

function QuantityField({ label, value, onChange, max }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        type="number"
        min="0"
        max={max}
        step="any"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#8D7BB8]"
      />
    </label>
  );
}
