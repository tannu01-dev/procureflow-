
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const roleNames = {
  company_admin: "Company Admin",
  procurement_manager: "Procurement Manager",
  requester: "Requester",
  approver: "Approver",
  finance: "Finance",
  auditor: "Auditor",
  vendor: "Vendor",
};

const roleRoutes = {
  company_admin: "/admin",
  procurement_manager: "/procurement",
  requester: "/requests",
  approver: "/approvals",
  finance: "/finance",
  auditor: "/audit",
  vendor: "/vendor",
};

const roleModules = {
  company_admin: [
    {
      title: "Company Profile",
      description: "View and manage your organisation details and team.",
      href: "/company",
      label: "Manage company",
    },
    {
      title: "Purchase Requests",
      description: "View, track and create purchase requests.",
      href: "/requests",
      label: "View requests",
    },
    {
      title: "Approval Workflow",
      description: "Review pending requests and manage approvals.",
      href: "/approvals",
      label: "Open approvals",
    },
    {
      title: "Vendor Management",
      description: "Manage vendors registered with your organisation.",
      href: "/vendors",
      label: "Manage vendors",
    },
    {
      title: "RFQ & Quotations",
      description:
        "Create requests for quotations, invite vendors and compare their offers.",
      href: "/rfqs",
      label: "Open RFQ module",
    },
    {
      title: "Finance & Payments",
      description: "Access invoice and payment management.",
      href: "/finance",
      label: "Open finance",
    },
    {
      title: "Risk Center & Audit Logs",
      description: "Review security events, failed actions and compliance activity.",
      href: "/risk-center",
      label: "Open risk center",
    },
    {
  title: "Purchase Orders",
  description:
    "Create purchase orders from vendor quotations and track their status.",
  href: "/purchase-orders",
  label: "Manage purchase orders",
},
{
  title: "Delivery & GRN",
  description:
    "Record deliveries, inspect received goods and track partial receipts.",
  href: "/goods-receipts",
  label: "Manage deliveries",
},
{
  title: "Invoice Management",
  description:
    "Record supplier invoices, run three-way matching and review discrepancies.",
  href: "/invoices",
  label: "Manage invoices",
},
  ],

  procurement_manager: [
    {
      title: "Purchase Requests",
      description: "Review purchase requests and track their status.",
      href: "/requests",
      label: "View requests",
    },
    {
      title: "Approval Workflow",
      description: "Open requests awaiting approval.",
      href: "/approvals",
      label: "Open approvals",
    },
    {
      title: "Vendor Management",
      description: "View and manage your vendor directory.",
      href: "/vendors",
      label: "Manage vendors",
    },
    {
      title: "RFQ & Quotations",
      description:
        "Create RFQs, record vendor quotations and compare offers.",
      href: "/rfqs",
      label: "Open RFQ module",
    },
    {
  title: "Purchase Orders",
  description:
    "Create purchase orders from vendor quotations and track their status.",
  href: "/purchase-orders",
  label: "Manage purchase orders",
},
    {
  title: "Delivery & GRN",
  description:
    "Record deliveries, inspect received goods and track partial receipts.",
  href: "/goods-receipts",
  label: "Manage deliveries",
},
{
  title: "Invoice Management",
  description:
    "Record supplier invoices, run three-way matching and review discrepancies.",
  href: "/invoices",
  label: "Manage invoices",
},
    {
      title: "Risk Center & Audit Logs",
      description: "Review high-risk activity and audit events for your workspace.",
      href: "/risk-center",
      label: "Review audit events",
    },
  ],

  requester: [
    {
      title: "Purchase Requests",
      description: "Create requests and track your submissions.",
      href: "/requests",
      label: "View requests",
    },
    {
      title: "Create Purchase Request",
      description: "Submit a new request for required goods or services.",
      href: "/requests/new",
      label: "Create request",
    },
  ],

  approver: [
    {
      title: "Approval Workflow",
      description: "Review, approve or reject assigned purchase requests.",
      href: "/approvals",
      label: "Open approvals",
    },
    {
      title: "Purchase Requests",
      description: "View purchase request records.",
      href: "/requests",
      label: "View requests",
    },
  ],

  finance: [
    {
      title: "Finance & Payments",
      description: "Manage invoices and payment processing.",
      href: "/finance",
      label: "Open finance",
    },
    {
      title: "Purchase Requests",
      description: "Review purchase request information.",
      href: "/requests",
      label: "View requests",
    },
    {
  title: "Invoice Management",
  description:
    "Record supplier invoices, run three-way matching and review discrepancies.",
  href: "/invoices",
  label: "Manage invoices",
},
    {
      title: "Risk Center & Audit Logs",
      description: "Review failed actions and sensitive finance-related activity.",
      href: "/risk-center",
      label: "Review audit events",
    },
  ],

  auditor: [
    {
      title: "Risk Center & Audit Logs",
      description: "Review audit logs and procurement activity.",
      href: "/risk-center",
      label: "Open risk center",
    },
    {
      title: "Purchase Requests",
      description: "Inspect purchase request records.",
      href: "/requests",
      label: "View requests",
    },
  ],

  vendor: [
    {
      title: "Vendor Workspace",
      description: "Access your vendor portal and procurement opportunities.",
      href: "/vendor",
      label: "Open vendor workspace",
    },
  ],
};

export default function WorkspaceDashboard({ requiredRole }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const token = sessionStorage.getItem("procureflow_token");
        const storedUser = sessionStorage.getItem("procureflow_user");

        if (!token || !storedUser) {
          router.replace("/");
          return;
        }

        let parsedUser;

        try {
          parsedUser = JSON.parse(storedUser);
        } catch {
          sessionStorage.removeItem("procureflow_token");
          sessionStorage.removeItem("procureflow_user");
          router.replace("/");
          return;
        }

        if (!parsedUser?.role) {
          sessionStorage.removeItem("procureflow_token");
          sessionStorage.removeItem("procureflow_user");
          router.replace("/");
          return;
        }

        const destination = roleRoutes[parsedUser.role];

        if (requiredRole && parsedUser.role !== requiredRole) {
          router.replace(destination || "/");
          return;
        }

        if (cancelled) return;
        setUser(parsedUser);

        if (parsedUser.role !== "vendor") {
          if (!parsedUser.companyId) {
            router.replace("/company");
            return;
          }

          const result = await apiRequest("/company/me");

          if (!cancelled) {
            setCompany(result.company || null);
          }
        }
      } catch (err) {
        if (cancelled) return;

        if (err.status === 401) {
          sessionStorage.removeItem("procureflow_token");
          sessionStorage.removeItem("procureflow_user");
          router.replace("/");
          return;
        }

        setError(err.message || "Could not load workspace.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [requiredRole, router]);

  function signOut() {
    sessionStorage.removeItem("procureflow_token");
    sessionStorage.removeItem("procureflow_user");
    router.replace("/");
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F5F1] text-[#242333]">
        <p className="text-sm font-medium">Loading workspace...</p>
      </main>
    );
  }

  const modules = roleModules[user?.role] || [];

  return (
    <main className="min-h-screen bg-[#F7F5F1] text-[#242333]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e6e1da] bg-white px-5 py-4 sm:px-8">
        <Link href="/" className="text-xl font-bold">
          ProcureFlow
        </Link>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-gray-500">
              {roleNames[user?.role] || user?.role}
            </p>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold transition hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8D7BB8]">
            Your workspace
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Welcome, {user?.name || "User"}
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            {company?.name || "Manage your ProcureFlow workspace."}
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-[#e6e1da] bg-white p-6">
            <p className="text-sm text-gray-500">Current role</p>

            <h2 className="mt-3 text-2xl font-bold">
              {roleNames[user?.role] || user?.role}
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              Your workspace modules depend on your assigned role and
              permissions.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e6e1da] bg-white p-6">
            <p className="text-sm text-gray-500">Organisation</p>

            <h2 className="mt-3 text-2xl font-bold">
              {company?.name ||
                (user?.role === "vendor"
                  ? "Vendor workspace"
                  : "Workspace")}
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              Manage authorised procurement activities from your workspace.
            </p>
          </div>
        </section>

        {["company_admin", "requester"].includes(user?.role) && (
          <section className="mt-6 rounded-2xl border border-[#e6e1da] bg-white p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold">
                  Create a purchase request
                </h2>

                <p className="mt-2 text-sm text-gray-600">
                  Start a request for the goods or services your team needs.
                </p>
              </div>

              <Link
                href="/requests/new"
                className="rounded-xl bg-[#242333] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#39374b]"
              >
                + New request
              </Link>
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-5">
            <h2 className="text-2xl font-bold">Workspace modules</h2>
            <p className="mt-2 text-sm text-gray-600">
              Choose a module to continue your work.
            </p>
          </div>

          {modules.length === 0 ? (
            <div className="rounded-2xl border border-[#e6e1da] bg-white p-6 text-sm text-gray-600">
              No modules are configured for this role yet.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((module) => (
                <article
                  key={module.href}
                  className="flex flex-col rounded-2xl border border-[#e6e1da] bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#c9bedf] hover:shadow-sm"
                >
                  <h3 className="text-lg font-bold">{module.title}</h3>

                  <p className="mt-3 flex-1 text-sm leading-6 text-gray-600">
                    {module.description}
                  </p>

                  <Link
                    href={module.href}
                    className="mt-5 inline-flex w-fit items-center rounded-xl border border-[#d9d0e9] bg-[#E9E5F2] px-4 py-2.5 text-sm font-semibold text-[#39334b] transition hover:bg-[#ddd6ed]"
                  >
                    {module.label}
                    <span className="ml-2" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="mt-8 text-xs text-gray-500">
          Current page: {pathname}
        </p>
      </div>
    </main>
  );
}
