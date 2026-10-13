
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const EMPTY_FORM = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  website: "",
  category: "",
  taxId: "",
  paymentTerms: "net_30",
  notes: "",
  address: {
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
  },
};

const CATEGORIES = [
  "IT & Software",
  "Office Supplies",
  "Raw Materials",
  "Equipment",
  "Logistics",
  "Professional Services",
  "Maintenance",
  "Other",
];

const PAYMENT_TERMS = [
  { value: "immediate", label: "Immediate" },
  { value: "net_15", label: "Net 15 days" },
  { value: "net_30", label: "Net 30 days" },
  { value: "net_45", label: "Net 45 days" },
  { value: "net_60", label: "Net 60 days" },
];

function Field({ label, children, required = false }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-[#393747]">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-[#e3dfeb] bg-white px-3.5 py-2.5 text-sm text-[#242333] outline-none transition focus:border-[#8D7BB8] focus:ring-2 focus:ring-[#8D7BB8]/15";

export default function VendorsPage() {
  const router = useRouter();

  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const query = params.toString();
      const result = await apiRequest(
        `/vendors${query ? `?${query}` : ""}`
      );

      setVendors(result.vendors || []);
    } catch (err) {
      if (err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err.message || "Could not load vendors.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, router]);

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
      const allowedRoles = ["company_admin", "procurement_manager"];

      if (!allowedRoles.includes(user.role)) {
        router.replace("/dashboard");
        return;
      }

      loadVendors();
    } catch {
      router.replace("/login");
    }
  }, [router, loadVendors]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateAddress(field, value) {
    setForm((current) => ({
      ...current,
      address: { ...current.address, [field]: value },
    }));
  }

  function openCreateForm() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      address: { ...EMPTY_FORM.address },
    });
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function openEditForm(vendor) {
    setEditingId(vendor._id);

    setForm({
      ...EMPTY_FORM,
      ...vendor,
      address: {
        ...EMPTY_FORM.address,
        ...(vendor.address || {}),
      },
    });

    setError("");
    setNotice("");
    setShowForm(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        category: form.category.trim(),
      };

      const result = editingId
        ? await apiRequest(`/vendors/${editingId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await apiRequest("/vendors", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      setNotice(
        result.message ||
          (editingId ? "Vendor updated." : "Vendor added.")
      );

      setShowForm(false);
      setEditingId(null);
      setForm({
        ...EMPTY_FORM,
        address: { ...EMPTY_FORM.address },
      });

      await loadVendors();
    } catch (err) {
      setError(err.message || "Unable to save vendor.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(vendor) {
    const nextStatus =
      vendor.status === "active" ? "inactive" : "active";

    const confirmed = window.confirm(
      `${nextStatus === "active" ? "Activate" : "Deactivate"} ${vendor.name}?`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      const result = await apiRequest(
        `/vendors/${vendor._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      setNotice(result.message || "Vendor status updated.");
      await loadVendors();
    } catch (err) {
      setError(err.message || "Could not update vendor status.");
    }
  }

  const activeCount = vendors.filter(
    (vendor) => vendor.status === "active"
  ).length;

  const inactiveCount = vendors.filter(
    (vendor) => vendor.status === "inactive"
  ).length;

  return (
    <main className="min-h-screen bg-[#F7F5F1] px-4 py-6 text-[#242333] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <button
              type="button"
              onClick={() => router.back()}
              className="mb-3 text-sm text-[#716987] hover:text-[#4f4568]"
            >
              ← Back
            </button>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8D7BB8]">
              ProcureFlow / Procurement
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Vendor Management
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#777382]">
              Manage supplier information, contact details and vendor
              availability in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-xl bg-[#242333] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#39364c]"
          >
            + Add vendor
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

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Vendors displayed", value: vendors.length },
            { label: "Active vendors", value: activeCount },
            { label: "Inactive vendors", value: inactiveCount },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-[#e9e5ef] bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-[#777382]">{metric.label}</p>
              <p className="mt-3 text-3xl font-bold">{metric.value}</p>
            </div>
          ))}
        </section>

        {showForm && (
          <section className="rounded-2xl border border-[#e9e5ef] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">
                  {editingId ? "Edit vendor" : "Add new vendor"}
                </h2>
                <p className="mt-1 text-sm text-[#777382]">
                  Fields marked * are required.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-3 py-2 text-sm text-[#716987] hover:bg-[#f5f2fa]"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-7">
              <div>
                <h3 className="mb-4 font-semibold">Basic information</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Vendor / company name" required>
                    <input
                      className={inputClass}
                      required
                      minLength={2}
                      maxLength={150}
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder="e.g. Acme Technologies"
                    />
                  </Field>

                  <Field label="Contact person">
                    <input
                      className={inputClass}
                      maxLength={100}
                      value={form.contactPerson}
                      onChange={(e) =>
                        updateField("contactPerson", e.target.value)
                      }
                      placeholder="Contact person's name"
                    />
                  </Field>

                  <Field label="Email address" required>
                    <input
                      className={inputClass}
                      type="email"
                      required
                      maxLength={254}
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="vendor@example.com"
                    />
                  </Field>

                  <Field label="Phone number" required>
                    <input
                      className={inputClass}
                      required
                      minLength={7}
                      maxLength={30}
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="+91 ..."
                    />
                  </Field>

                  <Field label="Website">
                    <input
                      className={inputClass}
                      type="text"
                      maxLength={200}
                      value={form.website}
                      onChange={(e) => updateField("website", e.target.value)}
                      placeholder="https://example.com"
                    />
                  </Field>

                  <Field label="Category" required>
                    <select
                      className={inputClass}
                      required
                      value={form.category}
                      onChange={(e) => updateField("category", e.target.value)}
                    >
                      <option value="">Select category</option>
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Tax ID / GSTIN">
                    <input
                      className={inputClass}
                      maxLength={50}
                      value={form.taxId}
                      onChange={(e) => updateField("taxId", e.target.value)}
                      placeholder="GSTIN or tax number"
                    />
                  </Field>

                  <Field label="Payment terms">
                    <select
                      className={inputClass}
                      value={form.paymentTerms}
                      onChange={(e) =>
                        updateField("paymentTerms", e.target.value)
                      }
                    >
                      {PAYMENT_TERMS.map((term) => (
                        <option key={term.value} value={term.value}>
                          {term.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <div>
                <h3 className="mb-4 font-semibold">Business address</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Street">
                    <input
                      className={inputClass}
                      maxLength={200}
                      value={form.address.street}
                      onChange={(e) =>
                        updateAddress("street", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="City">
                    <input
                      className={inputClass}
                      maxLength={100}
                      value={form.address.city}
                      onChange={(e) => updateAddress("city", e.target.value)}
                    />
                  </Field>

                  <Field label="State">
                    <input
                      className={inputClass}
                      maxLength={100}
                      value={form.address.state}
                      onChange={(e) => updateAddress("state", e.target.value)}
                    />
                  </Field>

                  <Field label="Postal code">
                    <input
                      className={inputClass}
                      maxLength={20}
                      value={form.address.postalCode}
                      onChange={(e) =>
                        updateAddress("postalCode", e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Country">
                    <input
                      className={inputClass}
                      maxLength={100}
                      value={form.address.country}
                      onChange={(e) =>
                        updateAddress("country", e.target.value)
                      }
                    />
                  </Field>
                </div>
              </div>

              <Field label="Internal notes">
                <textarea
                  className={inputClass}
                  rows={3}
                  maxLength={2000}
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Additional information about this vendor..."
                />
              </Field>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#8D7BB8] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#7765a4] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Create vendor"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-[#e3dfeb] px-6 py-3 text-sm font-semibold hover:bg-[#f8f6fb]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-[#e9e5ef] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#eeeaf3] p-5 sm:flex-row">
            <input
              className={`${inputClass} sm:max-w-sm`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or category..."
              aria-label="Search vendors"
            />

            <select
              className={`${inputClass} sm:max-w-48`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button
              type="button"
              onClick={loadVendors}
              className="rounded-xl border border-[#e3dfeb] px-4 py-2.5 text-sm font-semibold hover:bg-[#f8f6fb]"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-[#777382]">
              Loading vendors...
            </div>
          ) : vendors.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0ecf7] text-2xl">
                ♧
              </div>
              <h3 className="mt-4 font-semibold">No vendors found</h3>
              <p className="mt-2 text-sm text-[#777382]">
                Add your first vendor or change your search filters.
              </p>
              <button
                type="button"
                onClick={openCreateForm}
                className="mt-5 rounded-xl bg-[#242333] px-5 py-3 text-sm font-semibold text-white hover:bg-[#39364c]"
              >
                + Add vendor
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-[#faf9fc] text-xs uppercase tracking-wide text-[#777382]">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Vendor</th>
                    <th className="px-5 py-4 font-semibold">Category</th>
                    <th className="px-5 py-4 font-semibold">Contact</th>
                    <th className="px-5 py-4 font-semibold">Payment terms</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#f0edf4]">
                  {vendors.map((vendor) => (
                    <tr key={vendor._id} className="hover:bg-[#fcfbfe]">
                      <td className="px-5 py-4">
                        <p className="font-semibold">{vendor.name}</p>
                        <p className="mt-1 text-xs text-[#777382]">
                          {vendor.email}
                        </p>
                        {vendor.taxId && (
                          <p className="mt-1 text-xs text-[#777382]">
                            Tax ID: {vendor.taxId}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">{vendor.category}</td>

                      <td className="px-5 py-4">
                        <p>{vendor.contactPerson || "—"}</p>
                        <p className="mt-1 text-xs text-[#777382]">
                          {vendor.phone}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {PAYMENT_TERMS.find(
                          (term) => term.value === vendor.paymentTerms
                        )?.label || "Net 30 days"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            vendor.status === "active"
                              ? "bg-[#e9f5eb] text-[#2d7041]"
                              : "bg-[#f0edf4] text-[#716987]"
                          }`}
                        >
                          {vendor.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openEditForm(vendor)}
                            className="font-semibold text-[#7765a4] hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStatus(vendor)}
                            className="font-semibold text-[#6f687e] hover:underline"
                          >
                            {vendor.status === "active"
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-[#eeeaf3] px-5 py-4 text-xs text-[#777382]">
            Showing up to 500 vendors for the current filter.
          </div>
        </section>
      </div>
    </main>
  );
}
