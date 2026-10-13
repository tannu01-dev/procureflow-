"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const emptyItem = () => ({
  name: "",
  description: "",
  quantity: "1",
  unit: "piece",
  unitPrice: "0",
});

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

export default function NewPurchaseRequestPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    description: "",
    department: "",
    priority: "normal",
    neededBy: "",
    items: [emptyItem()],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [today, setToday] = useState("");

  useEffect(() => {
    const now = new Date();

    const localDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    setToday(localDate);
  }, []);

  const total = useMemo(
    () =>
      form.items.reduce(
        (sum, item) =>
          sum +
          Math.max(0, Number(item.quantity) || 0) *
            Math.max(0, Number(item.unitPrice) || 0),
        0
      ),
    [form.items]
  );

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function updateItem(index, field, value) {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addItem() {
    if (form.items.length >= 100) {
      setError("You can add a maximum of 100 items.");
      return;
    }

    setError("");
    setForm((previous) => ({
      ...previous,
      items: [...previous.items, emptyItem()],
    }));
  }

  function removeItem(index) {
    if (form.items.length === 1) {
      setError("At least one item is required.");
      return;
    }

    setForm((previous) => ({
      ...previous,
      items: previous.items.filter((_, itemIndex) => itemIndex !== index),
    }));
    setError("");
  }

  async function saveRequest(submitNow) {
    if (loading) return;

    setError("");

    if (!sessionStorage.getItem("procureflow_token")) {
      router.replace("/");
      return;
    }

    if (form.title.trim().length < 3) {
      setError("Title must contain at least 3 characters.");
      return;
    }

    if (
      form.items.some(
        (item) =>
          !item.name.trim() ||
          !Number.isFinite(Number(item.quantity)) ||
          Number(item.quantity) <= 0 ||
          !Number.isFinite(Number(item.unitPrice)) ||
          Number(item.unitPrice) < 0
      )
    ) {
      setError(
        "Har item ka name, positive quantity aur valid unit price enter karo."
      );
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...form,
        items: form.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      };

      const result = await apiRequest("/purchase-requests", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const request = result.request;

      if (!request?._id) {
        throw new Error("Server did not return the saved request.");
      }

      if (submitNow) {
        await apiRequest(`/purchase-requests/${request._id}/submit`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      }

      router.push(`/requests/${request._id}`);
    } catch (err) {
      if (err.status === 401) {
        router.replace("/");
        return;
      }

      setError(err.message || "Could not save the purchase request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F5F1] px-4 py-8 text-[#242333] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/requests"
          className="text-sm font-semibold text-[#71618f] hover:underline"
        >
          ← Back to requests
        </Link>

        <header className="mb-7 mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8D7BB8]">
            Procurement workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold">New purchase request</h1>
          <p className="mt-2 text-sm text-gray-600">
            Add the purchasing details and items required by your team.
          </p>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveRequest(false);
          }}
          className="space-y-6"
        >
          <section className="rounded-2xl border border-[#e6e1da] bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-bold">Request details</h2>
            <p className="mt-1 text-sm text-gray-500">
              Tell us what you need and when you need it.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                label="Request title *"
                name="title"
                value={form.title}
                onChange={updateField}
                placeholder="e.g. Office equipment for new team"
                required
                maxLength={150}
              />

              <Field
                label="Department"
                name="department"
                value={form.department}
                onChange={updateField}
                placeholder="e.g. Engineering"
                maxLength={100}
              />

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">
                  Priority
                </span>
                <select
                  name="priority"
                  value={form.priority}
                  onChange={updateField}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#8D7BB8]"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>

              <Field
                label="Required by"
                name="neededBy"
                type="date"
                value={form.neededBy}
                onChange={updateField}
                min={today || undefined}
              />

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold">
                  Description
                </span>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateField}
                  rows={3}
                  maxLength={2000}
                  placeholder="Why is this purchase needed?"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#8D7BB8]"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e6e1da] bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Requested items</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Enter quantity and price for each item.
                </p>
              </div>

              <button
                type="button"
                onClick={addItem}
                className="rounded-xl border border-[#d9d0e9] bg-[#E9E5F2] px-4 py-2.5 text-sm font-semibold text-[#39334b] hover:bg-[#ded7ed]"
              >
                + Add item
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {form.items.map((item, index) => {
                const lineTotal =
                  (Number(item.quantity) || 0) *
                  (Number(item.unitPrice) || 0);

                return (
                  <div
                    key={index}
                    className="rounded-xl border border-gray-200 p-4 sm:p-5"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold">Item {index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-sm font-semibold text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Item name *"
                        value={item.name}
                        onChange={(event) =>
                          updateItem(index, "name", event.target.value)
                        }
                        placeholder="e.g. Office chair"
                        required
                        maxLength={150}
                      />

                      <Field
                        label="Unit"
                        value={item.unit}
                        onChange={(event) =>
                          updateItem(index, "unit", event.target.value)
                        }
                        placeholder="piece, box, kg..."
                        maxLength={30}
                      />

                      <Field
                        label="Quantity *"
                        type="number"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                        min="0.01"
                        step="any"
                        required
                      />

                      <Field
                        label="Unit price (₹) *"
                        type="number"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateItem(index, "unitPrice", event.target.value)
                        }
                        min="0"
                        step="0.01"
                        required
                      />

                      <Field
                        label="Item description"
                        value={item.description}
                        onChange={(event) =>
                          updateItem(index, "description", event.target.value)
                        }
                        placeholder="Optional details"
                        maxLength={500}
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-lg bg-[#F7F5F1] px-4 py-3">
                      <span className="text-sm text-gray-600">
                        Item total
                      </span>
                      <strong>{money(lineTotal)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col justify-between gap-3 rounded-xl bg-[#242333] p-5 text-white sm:flex-row sm:items-center">
              <div>
                <p className="text-sm text-gray-300">Estimated request total</p>
                <p className="mt-1 text-xs text-gray-400">
                  Based on entered quantity and unit price
                </p>
              </div>
              <p className="text-2xl font-bold">{money(total)}</p>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/requests"
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-center text-sm font-semibold"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl border border-[#d9d0e9] bg-[#E9E5F2] px-5 py-3 text-sm font-semibold text-[#39334b] disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save draft"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => saveRequest(true)}
              className="rounded-xl bg-[#242333] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Please wait..." : "Submit for approval"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  ...props
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        {...props}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#8D7BB8]"
      />
    </label>
  );
}