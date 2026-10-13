"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();

  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [currentYear, setCurrentYear] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  function updateField(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  
function switchMode(nextMode) {
  setMode(nextMode);
  setNotice(null);
  setShowPassword(false);

  setForm({
    name: "",
    email: "",
    password: "",
  });
}


  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);

    if (loading) return;

    const email = form.email.trim().toLowerCase();

    if (mode === "register" && form.name.trim().length < 2) {
      setNotice({
        type: "error",
        text: "Please enter your full name.",
      });
      return;
    }

    if (!email) {
      setNotice({
        type: "error",
        text: "Please enter your email address.",
      });
      return;
    }

    if (mode !== "forgot" && form.password.length < 8) {
      setNotice({
        type: "error",
        text: "Password must contain at least 8 characters.",
      });
      return;
    }

    setLoading(true);

    try {
      // STEP 1: Forgot password
      if (mode === "forgot") {
        const result = await apiRequest("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email }),
        });

        setNotice({
          type: "success",
          text:
            result.message ||
            "If the account exists, reset instructions will be provided.",
        });

        return;
      }

      // STEP 2: Select login or registration endpoint
      const endpoint =
        mode === "register" ? "/auth/register" : "/auth/login";

      const payload =
        mode === "register"
          ? {
              name: form.name.trim(),
              email,
              password: form.password,
            }
          : {
              email,
              password: form.password,
            };

      // STEP 3: Get API response BEFORE using result
      const result = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // STEP 4: Check backend response
      if (!result || !result.token || !result.user) {
        throw new Error(
          "Backend response mein token ya user details missing hain. Backend auth controller check karna hoga."
        );
      }

      // STEP 5: Save session
      sessionStorage.setItem("procureflow_token", result.token);
      sessionStorage.setItem(
        "procureflow_user",
        JSON.stringify(result.user)
      );

      const user = result.user;

      // STEP 6: Redirect according to role
      const roleRoutes = {
        company_admin: "/admin",
        procurement_manager: "/procurement",
        requester: "/requests",
        approver: "/approvals",
        finance: "/finance",
        auditor: "/audit",
        vendor: "/vendor",
      };

      setNotice({
        type: "success",
        text:
          mode === "register"
            ? "Account created successfully. Redirecting..."
            : "Login successful. Redirecting...",
      });

      if (!user.companyId && user.role !== "vendor") {
        router.replace("/company");
        return;
      }

      const destination = roleRoutes[user.role];

      if (!destination) {
        sessionStorage.removeItem("procureflow_token");
        sessionStorage.removeItem("procureflow_user");

        throw new Error(
          `User role missing or unsupported: ${user.role || "not assigned"}`
        );
      }

      router.replace(destination);
    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";

  return (
    <main className="auth-shell">
      <section className="visual-panel">
        <div className="visual-glow visual-glow-one" />
        <div className="visual-glow visual-glow-two" />

        <a className="brand" href="/" aria-label="ProcureFlow home">
          <span className="brand-mark">
            <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <path
                d="M8 12.5 20 6l12 6.5v14L20 33 8 26.5v-14Z"
                stroke="currentColor"
                strokeWidth="2.2"
              />
              <path
                d="m8.5 12.8 11.5 6.4 11.5-6.4M20 19.2V32"
                stroke="currentColor"
                strokeWidth="2.2"
              />
              <path
                d="m14.5 9 12 6.5"
                stroke="currentColor"
                strokeWidth="2.2"
              />
            </svg>
          </span>

          <span>
            <strong>ProcureFlow</strong>
            <small>PROCUREMENT INTELLIGENCE</small>
          </span>
        </a>

        <div className="visual-copy">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            PROCUREMENT, CONNECTED
          </span>

          <h1>
            Every purchase.
            <br />
            <span>One clear flow.</span>
          </h1>

          <p>
            Bring purchasing, suppliers, approvals and payments together in
            one organised workspace.
          </p>
        </div>

        <div className="logistics-scene" aria-hidden="true">
          <div className="scene-sun" />
          <div className="scene-orbit orbit-one" />
          <div className="scene-orbit orbit-two" />

          <div className="warehouse">
            <div className="warehouse-roof" />
            <div className="warehouse-body">
              <div className="warehouse-window" />
              <div className="warehouse-window" />
              <div className="warehouse-door" />
            </div>
          </div>

          <div className="route-line route-one" />
          <div className="route-line route-two" />

          <div className="shipment-card shipment-card-one">
            <span className="shipment-icon">↗</span>
            <span>
              <strong>Orders</strong>
              <small>Moving forward</small>
            </span>
          </div>

          <div className="shipment-card shipment-card-two">
            <span className="shipment-icon">✓</span>
            <span>
              <strong>One workflow</strong>
              <small>Connected operations</small>
            </span>
          </div>

          <div className="road">
            <span />
          </div>
        </div>

        <div className="visual-footer">
          <span>SMARTER SOURCING</span>
          <span className="footer-separator" />
          <span>BETTER CONTROL</span>
          <span className="footer-separator" />
          <span>COMPLETE VISIBILITY</span>
        </div>
      </section>

      <section className="form-panel">
        <div className="form-topline">
          <span>WELCOME TO PROCUREFLOW</span>

          <span className="secure-label">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="4.5"
                y="8.5"
                width="11"
                height="8"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M7 8.5V6a3 3 0 0 1 6 0v2.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            Secure access
          </span>
        </div>

        <div className="auth-card">
          <div className="mobile-brand">
            <span className="brand-mark">
              <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path
                  d="M8 12.5 20 6l12 6.5v14L20 33 8 26.5v-14Z"
                  stroke="currentColor"
                  strokeWidth="2.2"
                />
                <path
                  d="m8.5 12.8 11.5 6.4 11.5-6.4M20 19.2V32"
                  stroke="currentColor"
                  strokeWidth="2.2"
                />
              </svg>
            </span>

            <strong>ProcureFlow</strong>
          </div>

          <div className="form-heading">
            <span className="form-kicker">
              {isLogin
                ? "YOUR WORKSPACE AWAITS"
                : isRegister
                  ? "GET STARTED"
                  : "ACCOUNT RECOVERY"}
            </span>

            <h2>
              {isLogin
                ? "Welcome back"
                : isRegister
                  ? "Create your account"
                  : "Forgot password?"}
            </h2>

            <p>
              {isLogin
                ? "Sign in to continue to your workspace."
                : isRegister
                  ? "Set up your ProcureFlow account in a few steps."
                  : "Enter your email and we’ll help you reset your password."}
            </p>
          </div>

          {notice && (
            <div
              className={`notice notice-${notice.type}`}
              role="status"
              aria-live="polite"
            >
              {notice.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
            {isRegister && (
              <label className="field">
                <span>Full name</span>
                <input
                  type="text"
                  name="name"
                  autoComplete="off"
                  placeholder="Enter your full name"
                  value={form.name}
                  onChange={updateField}
                  minLength={2}
                  maxLength={80}
                  required
                />
              </label>
            )}

            <label className="field">
              <span>Work email</span>
              <input
                type="email"
                name="email"
                autoComplete="off"
                placeholder="you@company.com"
                value={form.email}
                onChange={updateField}
                maxLength={254}
                required
              />
            </label>

            {!isForgot && (
              <label className="field">
                <span>Password</span>

                <div className="password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="new-password"
                    placeholder={
                      isRegister
                        ? "Create a strong password"
                        : "Enter your password"
                    }
                    value={form.password}
                    onChange={updateField}
                    minLength={8}
                    maxLength={72}
                    required
                  />

                  <button
                    className="show-password"
                    type="button"
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {isRegister && (
                  <small className="field-hint">
                    Use at least 8 characters.
                  </small>
                )}
              </label>
            )}

            {isLogin && (
              <div className="form-options">
                <span className="remember-note">
                  Protected account access
                </span>

                <button
                  type="button"
                  className="text-button"
                  onClick={() => switchMode("forgot")}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isLogin
                  ? "Sign in to your account"
                  : isRegister
                    ? "Create account"
                    : "Send reset instructions"}

              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="switch-auth">
            {isLogin ? (
              <>
                Don’t have an account?{" "}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => switchMode("register")}
                >
                  Sign up
                </button>
              </>
            ) : isRegister ? (
              <>
                Already registered?{" "}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => switchMode("login")}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Remember your password?{" "}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => switchMode("login")}
                >
                  Back to sign in
                </button>
              </>
            )}
          </div>

          <div className="form-divider">
            <span />
            <small>PROCUREMENT MADE CLEAR</small>
            <span />
          </div>

          <p className="privacy-note">
            By continuing, you agree to use this workspace in accordance
            with your organisation’s policies.
          </p>
        </div>

        <footer className="form-footer">
          <span>© {currentYear ?? "2026"} ProcureFlow</span>
          <span>Built for better operations</span>
        </footer>
      </section>
    </main>
  );
}