"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

export default function PurchaseRequestDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F7F5F1] p-10 text-[#242333]">
          Loading request...
        </main>
      }
    >
      <PurchaseRequestDetailContent />
    </Suspense>
  );
}

function PurchaseRequestDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const [request, setRequest] = useState(null);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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

  const loadRequest = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await apiRequest(`/purchase-requests/${id}`);
      setRequest(result.request);
      setForm({
        title: result.request.title || "",
        description: result.request.description || "",
        department: result.request.department || "",
        priority: result.request.priority || "normal",
        neededBy: result.request.neededBy
          ? new Date(result.request.neededBy).toISOString().slice(0, 10)
          : "",
        items: (result.request.items || []).map((item) => ({
          name: item.name || "",
          description: item.description || "",
          quantity: String(item.quantity ?? 1),
          unit: item.unit || "piece",
          unitPrice: String(item.unitPrice ?? 0),
        })),
      });
    } catch (err) {
      if (err.status === 401) {
        router.replace("/");
        return;
      }
      setError(err.message || "Could not load request.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!sessionStorage.getItem("procureflow_token")) {
      router.replace("/");
      return;
    }
    loadRequest();
  }, [loadRequest, router]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function updateItem(index, field, value) {
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  async function saveChanges(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (form.title.trim().length < 3) {
      setError("Title must contain at least 3 characters.");
      return;
    }

    if (
      form.items.length === 0 ||
      form.items.some(
        (item) =>
          !item.name.trim() ||
          Number(item.quantity) <= 0 ||
          !Number.isFinite(Number(item.quantity)) ||
          Number(item.unitPrice) < 0 ||
          !Number.isFinite(Number(item.unitPrice))
      )
    ) {
      setError("Check each item's name, quantity and unit price.");
      return;
    }

    setSaving(true);

    try {
      const result = await apiRequest(`/purchase-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          items: form.items.map((item) => ({
            ...item,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
          })),
        }),
      });

      setRequest(result.request);
      setEditing(false);
      setMessage("Draft updated successfully.");
      await loadRequest();
    } catch (err) {
      setError(err.message || "Could not update request.");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action) {
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const result = await apiRequest(
        `/purchase-requests/${id}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      setRequest(result.request);
      setMessage(result.message || "Request updated.");
      await loadRequest();
    } catch (err) {
      setError(err.message || "Action failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F5F1] p-10 text-[#242333]">
        Loading request...
      </main>
    );
  }

  if (!request) {
    return (
      <main className="min-h-screen bg-[#F7F5F1] p-8 text-[#242333]">
        <p className="text-red-700">{error || "Request not found."}</p>
        <Link className="mt-4 inline-block underline" href="/requests">
          Back to requests
        </Link>
      </main>
    );
  }

  const isDraft = request.status === "draft";
  const total = (form?.items || []).reduce(
    (sum, item) =>
      sum +
      (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  );

  return (
    <main className="min-h-screen bg-[#F7F5F1] px-4 py-8 text-[#242333] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/requests"
          className="text-sm font-semibold text-[#71618f] hover:underline"
        >
          ← Back to requests
        </Link>

        <header className="mb-7 mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8D7BB8]">
              {request.requestNumber}
            </p>
            <h1 className="mt-2 text-3xl font-bold">{request.title}</h1>
            <p className="mt-2 text-sm text-gray-600">
              Created{" "}
              {new Date(request.createdAt).toLocaleDateString("en-IN")}
            </p>
          </div>

          <span className="w-fit rounded-full bg-[#E9E5F2] px-4 py-2 text-sm font-semibold capitalize">
            {request.status}
          </span>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {message}
          </div>
        )}

        {editing && isDraft && form ? (
          <form onSubmit={saveChanges} className="space-y-6">
            <section className="space-y-4 rounded-2xl border border-[#e6e1da] bg-white p-5 sm:p-7">
              <h2 className="text-lg font-bold">Edit request details</h2>

              <Field
                label="Title"
                name="title"
                value={form.title}
                onChange={updateField}
                required
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Department"
                  name="department"
                  value={form.department}
                  onChange={updateField}
                />

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Priority
                  </span>
                  <select
                    name="priority"
                    value={form.priority}
                    onChange={updateField}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3"
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
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">
                  Description
                </span>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateField}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3"
                />
              </label>
            </section>

            <section className="space-y-4 rounded-2xl border border-[#e6e1da] bg-white p-5 sm:p-7">
              <h2 className="text-lg font-bold">Items</h2>

              {form.items.map((item, index) => (
                <div
                  key={index}
                  className="grid gap-4 rounded-xl border border-gray-200 p-4 sm:grid-cols-2"
                >
                  <Field
                    label="Item name"
                    value={item.name}
                    onChange={(event) =>
                      updateItem(index, "name", event.target.value)
                    }
                    required
                  />

                  <Field
                    label="Unit"
                    value={item.unit}
                    onChange={(event) =>
                      updateItem(index, "unit", event.target.value)
                    }
                  />

                  <Field
                    label="Quantity"
                    type="number"
                    min="0.01"
                    step="any"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(index, "quantity", event.target.value)
                    }
                    required
                  />

                  <Field
                    label="Unit price (₹)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) =>
                      updateItem(index, "unitPrice", event.target.value)
                    }
                    required
                  />

                  <Field
                    label="Description"
                    value={item.description}
                    onChange={(event) =>
                      updateItem(index, "description", event.target.value)
                    }
                  />

                  <p className="self-end pb-3 font-semibold">
                    Line total:{" "}
                    {money(
                      Number(item.quantity || 0) *
                        Number(item.unitPrice || 0)
                    )}
                  </p>
                </div>
              ))}

              <div className="rounded-xl bg-[#242333] p-4 text-right text-white">
                <span className="text-sm text-gray-300">Estimated total</span>
                <p className="mt-1 text-2xl font-bold">{money(total)}</p>
              </div>
            </section>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold"
              >
                Stop editing
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#242333] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <section className="rounded-2xl border border-[#e6e1da] bg-white p-5 sm:p-7">
              <h2 className="text-lg font-bold">Request information</h2>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Info label="Department" value={request.department || "—"} />
                <Info
                  label="Priority"
                  value={request.priority}
                  capitalize
                />
                <Info
                  label="Required by"
                  value={
                    request.neededBy
                      ? new Date(request.neededBy).toLocaleDateString("en-IN")
                      : "Not specified"
                  }
                />
                <Info
                  label="Requested by"
                  value={request.requestedBy?.name || "—"}
                />
                <div className="sm:col-span-2">
                  <Info
                    label="Description"
                    value={request.description || "No description provided."}
                  />
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-[#e6e1da] bg-white p-5 sm:p-7">
              <h2 className="text-lg font-bold">Items and costs</h2>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wider text-gray-500">
                      <th className="py-3 pr-3">Item</th>
                      <th className="py-3 pr-3">Quantity</th>
                      <th className="py-3 pr-3">Unit price</th>
                      <th className="py-3 text-right">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.items?.map((item) => (
                      <tr key={item._id} className="border-b border-gray-100">
                        <td className="py-4 pr-3">
                          <p className="font-semibold">{item.name}</p>
                          {item.description && (
                            <p className="mt-1 text-xs text-gray-500">
                              {item.description}
                            </p>
                          )}
                        </td>
                        <td className="py-4 pr-3">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-4 pr-3">{money(item.unitPrice)}</td>
                        <td className="py-4 text-right font-semibold">
                          {money(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex justify-end">
                <div className="w-full rounded-xl bg-[#242333] p-5 text-white sm:max-w-xs">
                  <p className="text-sm text-gray-300">Request total</p>
                  <p className="mt-2 text-2xl font-bold">
                    {money(request.totalAmount)}
                  </p>
                </div>
              </div>
            </section>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              {isDraft && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold"
                  >
                    Edit draft
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => runAction("submit")}
                    className="rounded-xl bg-[#242333] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Submit for approval
                  </button>
                </>
              )}

              {["draft", "submitted"].includes(request.status) && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to cancel this request?"
                      )
                    ) {
                      runAction("cancel");
                    }
                  }}
                  className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
                >
                  Cancel request
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Field({ label, name, value, onChange, type = "text", ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        {...props}
        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#8D7BB8]"
      />
    </label>
  );
}

function Info({ label, value, capitalize = false }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className={`mt-2 text-sm font-medium ${capitalize ? "capitalize" : ""}`}>
        {value}
      </p>
    </div>
  );
}