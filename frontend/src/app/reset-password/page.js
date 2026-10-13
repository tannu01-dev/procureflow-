
"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);

    if (!token) {
      setNotice({
        type: "error",
        text: "This reset link is missing its token. Request a new link.",
      });
      return;
    }

    if (password.length < 8 || password.length > 72) {
      setNotice({
        type: "error",
        text: "Password must contain 8–72 characters.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setNotice({
        type: "error",
        text: "Passwords do not match.",
      });
      return;
    }

    setLoading(true);

    try {
      const result = await apiRequest("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });

      setNotice({
        type: "success",
        text: result.message || "Password reset successfully.",
      });

      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Unable to reset password.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="reset-shell">
      <section className="reset-card">
        <Link href="/" className="reset-brand">
          <span className="reset-brand-mark">P</span>
          <span>ProcureFlow</span>
        </Link>

        <span className="form-kicker">ACCOUNT RECOVERY</span>
        <h1>Set a new password</h1>
        <p className="reset-description">
          Choose a new password for your ProcureFlow account.
        </p>

        {notice && (
          <div
            className={`notice notice-${notice.type}`}
            role="status"
            aria-live="polite"
          >
            {notice.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field">
            <span>New password</span>
            <div className="password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter a new password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={72}
                required
              />
              <button
                className="show-password"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <label className="field">
            <span>Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              maxLength={72}
              required
            />
          </label>

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Updating password..." : "Reset password"}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <p className="reset-back">
          <Link href="/">← Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="reset-shell">
          <section className="reset-card">Loading password recovery...</section>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
