
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const ROLE_OPTIONS = [
  { value: "procurement_manager", label: "Procurement Manager" },
  { value: "requester", label: "Requester" },
  { value: "approver", label: "Approver" },
  { value: "finance", label: "Finance" },
  { value: "auditor", label: "Auditor" },
];

const EMPTY_COMPANY = {
  name: "",
  legalName: "",
  email: "",
  phone: "",
  address: "",
  industry: "",
};

export default function CompanyPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(EMPTY_COMPANY);
  const [members, setMembers] = useState([]);
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "requester",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const [editingCompany, setEditingCompany] = useState(false);
  const [companyExists, setCompanyExists] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      const token = sessionStorage.getItem("procureflow_token");
      const savedUser = sessionStorage.getItem("procureflow_user");

      if (!token || !savedUser) {
        router.replace("/");
        return;
      }

      try {
        const parsedUser = JSON.parse(savedUser);

        if (!cancelled) setUser(parsedUser);

        if (!parsedUser.companyId) {
          if (!cancelled) {
            setCompanyExists(false);
            setLoading(false);
          }
          return;
        }

        const result = await apiRequest("/company/me");

        if (!cancelled) {
          setCompany(result.company);
          setCompanyExists(true);
        }

        if (parsedUser.role === "company_admin") {
          try {
            const memberResult = await apiRequest("/company/members");
            if (!cancelled) setMembers(memberResult.members || []);
          } catch (error) {
            if (!cancelled) {
              setNotice({ type: "error", text: error.message });
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({ type: "error", text: error.message });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function updateCompanyField(event) {
    setCompany((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  }

  function updateMemberField(event) {
    setMemberForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  }

  async function saveCompany(event) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const result = companyExists
        ? await apiRequest("/company/me", {
            method: "PATCH",
            body: JSON.stringify(company),
          })
        : await apiRequest("/company", {
            method: "POST",
            body: JSON.stringify(company),
          });

      setCompany(result.company);
      setCompanyExists(true);

      if (result.user) {
        sessionStorage.setItem(
          "procureflow_user",
          JSON.stringify(result.user)
        );
        setUser(result.user);
      }

      setEditingCompany(false);
      setNotice({
        type: "success",
        text: result.message || "Company saved successfully.",
      });

      if (result.user?.role === "company_admin") {
        router.replace("/admin");
      }
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function createMember(event) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const result = await apiRequest("/company/members", {
        method: "POST",
        body: JSON.stringify(memberForm),
      });

      setMembers((previous) => [result.member, ...previous]);
      setMemberForm({
        name: "",
        email: "",
        password: "",
        role: "requester",
      });

      setNotice({ type: "success", text: result.message });
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(member, role) {
    setNotice(null);

    try {
      const result = await apiRequest(
        `/company/members/${member.id}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role }),
        }
      );

      setMembers((previous) =>
        previous.map((item) =>
          item.id === member.id ? result.member : item
        )
      );

      setNotice({ type: "success", text: result.message });
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    }
  }

  async function toggleMemberStatus(member) {
    const status = member.status === "active" ? "disabled" : "active";
    setNotice(null);

    try {
      const result = await apiRequest(
        `/company/members/${member.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      );

      setMembers((previous) =>
        previous.map((item) =>
          item.id === member.id ? result.member : item
        )
      );

      setNotice({ type: "success", text: result.message });
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    }
  }

  function signOut() {
    sessionStorage.removeItem("procureflow_token");
    sessionStorage.removeItem("procureflow_user");
    router.replace("/");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F5F1] p-8 text-[#242333]">
        Loading company workspace...
      </main>
    );
  }

  if (!user) return null;

  const isAdmin = user.role === "company_admin";

  return (
    <main className="min-h-screen bg-[#F7F5F1] text-[#242333]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E9E5F2] text-xl font-bold text-[#655185]">
              P
            </div>
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-[#817b8d]">
                PROCUREFLOW
              </p>
              <h1 className="text-2xl font-bold tracking-tight">
                Company workspace
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#e5dfeb] bg-white px-4 py-2 text-sm font-medium">
              {user.role.replaceAll("_", " ")}
            </span>
            <button
              onClick={signOut}
              className="rounded-xl border border-[#ded8e5] px-4 py-2 text-sm font-semibold hover:bg-white"
            >
              Sign out
            </button>
          </div>
        </header>

        {notice && (
          <div
            role="status"
            className={`mb-6 rounded-xl border p-4 text-sm ${
              notice.type === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-[#d9cfea] bg-[#eee9f6] text-[#51416f]"
            }`}
          >
            {notice.text}
          </div>
        )}

        {!companyExists && (
          <section className="mb-8 rounded-3xl border border-[#e9e3ed] bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold tracking-[0.18em] text-[#827294]">
              FIRST-TIME SETUP
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Create your company workspace
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#777483]">
              Set up your organisation first. Your account will become the
              Company Admin account for this workspace.
            </p>

            <form
              onSubmit={saveCompany}
              className="mt-6 grid gap-4 sm:grid-cols-2"
            >
              <Field label="Company name" name="name" value={company.name} onChange={updateCompanyField} required />
              <Field label="Legal name (optional)" name="legalName" value={company.legalName} onChange={updateCompanyField} />
              <Field label="Company email" name="email" type="email" value={company.email} onChange={updateCompanyField} />
              <Field label="Phone" name="phone" value={company.phone} onChange={updateCompanyField} />
              <Field label="Industry" name="industry" value={company.industry} onChange={updateCompanyField} />
              <Field label="Address" name="address" value={company.address} onChange={updateCompanyField} />

              <div className="sm:col-span-2">
                <button
                  disabled={saving}
                  className="rounded-xl bg-[#242333] px-6 py-3 font-semibold text-white hover:bg-[#3a384b] disabled:opacity-60"
                >
                  {saving ? "Creating workspace..." : "Create company workspace"}
                </button>
              </div>
            </form>
          </section>
        )}

        {companyExists && (
          <>
            <section className="mb-8 rounded-3xl border border-[#e9e3ed] bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.18em] text-[#827294]">
                    ORGANISATION PROFILE
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    {company.name}
                  </h2>
                  <p className="mt-2 text-sm text-[#777483]">
                    {company.industry || "Industry not specified"}
                    {company.email ? ` · ${company.email}` : ""}
                  </p>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => setEditingCompany((value) => !value)}
                    className="rounded-xl border border-[#ded8e5] px-4 py-2 text-sm font-semibold hover:bg-[#f7f5fa]"
                  >
                    {editingCompany ? "Cancel editing" : "Edit company"}
                  </button>
                )}
              </div>

              {editingCompany && isAdmin && (
                <form
                  onSubmit={saveCompany}
                  className="mt-6 grid gap-4 sm:grid-cols-2"
                >
                  <Field label="Company name" name="name" value={company.name} onChange={updateCompanyField} required />
                  <Field label="Legal name" name="legalName" value={company.legalName || ""} onChange={updateCompanyField} />
                  <Field label="Company email" name="email" type="email" value={company.email || ""} onChange={updateCompanyField} />
                  <Field label="Phone" name="phone" value={company.phone || ""} onChange={updateCompanyField} />
                  <Field label="Industry" name="industry" value={company.industry || ""} onChange={updateCompanyField} />
                  <Field label="Address" name="address" value={company.address || ""} onChange={updateCompanyField} />

                  <div className="sm:col-span-2">
                    <button
                      disabled={saving}
                      className="rounded-xl bg-[#242333] px-6 py-3 font-semibold text-white disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save company details"}
                    </button>
                  </div>
                </form>
              )}
            </section>

            {isAdmin ? (
              <>
                <section className="mb-8 grid gap-4 sm:grid-cols-3">
                  <Metric label="Team members" value={members.length} />
                  <Metric label="Active accounts" value={members.filter((m) => m.status === "active").length} />
                  <Metric label="Available roles" value={ROLE_OPTIONS.length} />
                </section>

                <section className="mb-8 rounded-3xl border border-[#e9e3ed] bg-white p-6 shadow-sm sm:p-8">
                  <p className="text-xs font-bold tracking-[0.18em] text-[#827294]">
                    TEAM MANAGEMENT
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    Add a team member
                  </h2>
                  <p className="mt-2 text-sm text-[#777483]">
                    Create a separate account for each employee and assign
                    their role.
                  </p>

                  <form onSubmit={createMember} className="mt-6 grid gap-4 sm:grid-cols-2">
                    <Field label="Full name" name="name" value={memberForm.name} onChange={updateMemberField} required />
                    <Field label="Work email" name="email" type="email" value={memberForm.email} onChange={updateMemberField} required />
                    <Field label="Temporary password" name="password" type="password" value={memberForm.password} onChange={updateMemberField} required />
                    <label className="grid gap-2 text-sm font-medium">
                      Role
                      <select
                        name="role"
                        value={memberForm.role}
                        onChange={updateMemberField}
                        className="min-h-12 rounded-xl border border-[#e3deea] bg-white px-3 outline-none focus:border-[#8d7bb8]"
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="sm:col-span-2">
                      <button
                        disabled={saving}
                        className="rounded-xl bg-[#242333] px-6 py-3 font-semibold text-white hover:bg-[#3a384b] disabled:opacity-60"
                      >
                        {saving ? "Creating account..." : "Create team account"}
                      </button>
                    </div>
                  </form>
                </section>

                <section className="rounded-3xl border border-[#e9e3ed] bg-white p-6 shadow-sm sm:p-8">
                  <div className="mb-5">
                    <p className="text-xs font-bold tracking-[0.18em] text-[#827294]">
                      ACCESS DIRECTORY
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">
                      Company members
                    </h2>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#eee9f1] text-[#777483]">
                          <th className="px-3 py-4 font-semibold">Member</th>
                          <th className="px-3 py-4 font-semibold">Role</th>
                          <th className="px-3 py-4 font-semibold">Status</th>
                          <th className="px-3 py-4 font-semibold">Change role</th>
                          <th className="px-3 py-4 font-semibold">Account</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member) => (
                          <tr key={member.id} className="border-b border-[#f0edf3] last:border-0">
                            <td className="px-3 py-4">
                              <div className="font-semibold">{member.name}</div>
                              <div className="mt-1 text-xs text-[#777483]">{member.email}</div>
                            </td>
                            <td className="px-3 py-4">
                              {member.role.replaceAll("_", " ")}
                            </td>
                            <td className="px-3 py-4">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                member.status === "active"
                                  ? "bg-[#e8f3eb] text-[#326849]"
                                  : "bg-[#f9e9e8] text-[#9c4444]"
                              }`}>
                                {member.status}
                              </span>
                            </td>
                            <td className="px-3 py-4">
                              {member.role === "company_admin" ? (
                                <span className="text-xs text-[#777483]">Admin protected</span>
                              ) : (
                                <select
                                  value={member.role}
                                  onChange={(event) => changeRole(member, event.target.value)}
                                  className="rounded-lg border border-[#e3deea] bg-white px-2 py-2"
                                >
                                  {ROLE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-3 py-4">
                              {member.role === "company_admin" ? (
                                <span className="text-xs text-[#777483]">Protected</span>
                              ) : (
                                <button
                                  onClick={() => toggleMemberStatus(member)}
                                  className="font-semibold text-[#655185] hover:underline"
                                >
                                  {member.status === "active" ? "Disable" : "Enable"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {members.length === 0 && (
                      <p className="py-8 text-center text-sm text-[#777483]">
                        No team members yet. Create the first employee account above.
                      </p>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <section className="rounded-3xl border border-[#e9e3ed] bg-white p-6">
                <h2 className="text-xl font-bold">Your workspace</h2>
                <p className="mt-2 text-sm leading-6 text-[#777483]">
                  Your account is connected to {company.name}. Your role-based
                  dashboard and procurement features will appear as their
                  respective phases are completed.
                </p>
              </section>
            )}
          </>
        )}
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
  required = false,
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        type={type}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        required={required}
        minLength={name === "name" ? 2 : undefined}
        maxLength={name === "password" ? 72 : 500}
        className="min-h-12 rounded-xl border border-[#e3deea] bg-white px-3 outline-none transition focus:border-[#8d7bb8] focus:ring-2 focus:ring-[#e9e5f2]"
      />
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#e9e3ed] bg-white p-5 shadow-sm">
      <p className="text-sm text-[#777483]">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
