"use client";
import { PreservedForm } from "@/components/ui/PreservedForm";
import { GoogleButton } from "./GoogleButton";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { signIn } from "next-auth/react";
import { registerUser } from "@/app/actions/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
export function AuthForm({
  register = false,
  next,
  passwordChanged = false,
  googleEnabled = false,
  oauthError,
  initialName,
  initialEmail,
}: {
  register?: boolean;
  next: string;
  passwordChanged?: boolean;
  googleEnabled?: boolean;
  oauthError?: "link" | "denied" | "failed";
  initialName?: string;
  initialEmail?: string;
}) {
  const t = useTranslations("auth");
  const google = useTranslations("googleAuth");
  const guest = useTranslations("guest");
  const recovery = useTranslations("recovery");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(form: FormData) {
    setPending(true);
    setError("");
    let accountCreated = false;
    const loginPath = "/" + locale + "/login?next=" + encodeURIComponent(next);
    try {
      if (register) {
        const result = await registerUser(form);
        if (result.error) {
          setError(errors(result.error));
          return;
        }
        accountCreated = true;
      }
      const result = await signIn("credentials", {
        email: form.get("email"),
        password: form.get("password"),
        redirect: false,
      });
      if (result?.error && accountCreated) {
        router.push(loginPath);
      } else if (result?.error)
        setError(
          errors(
            result.code === "rateLimited"
              ? "rateLimited"
              : "invalidCredentials",
          ),
        );
      else {
        router.push(next);
        router.refresh();
      }
    } catch {
      if (accountCreated) router.push(loginPath);
      else setError(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="public-container auth-container">
      <Card>
        <CardHeader>
          <CardTitle as="h1">
            {t(register ? "signUpTitle" : "signInTitle")}
          </CardTitle>
          <CardDescription>
            {t(register ? "signUpDescription" : "signInDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {oauthError && (
            <p role="alert" className="oauth-error">
              {google(
                oauthError === "link"
                  ? "linkRequired"
                  : oauthError === "denied"
                    ? "denied"
                    : "error",
              )}
            </p>
          )}
          {googleEnabled && (
            <div className="stack google-entry">
              <GoogleButton next={next} disabled={pending} />
              <p className="auth-divider">{google("or")}</p>
            </div>
          )}
          {passwordChanged && <p role="status">{recovery("resetSuccess")}</p>}
          <PreservedForm action={submit} className="stack" aria-busy={pending}>
            {error && <p role="alert">{error}</p>}
            {register && (
              <Input
                id="name"
                name="name"
                defaultValue={initialName}
                label={t("fullName")}
                autoComplete="name"
                maxLength={120}
                required
              />
            )}
            <Input
              id="email"
              name="email"
              defaultValue={initialEmail}
              type="email"
              label={t("email")}
              autoComplete="email"
              maxLength={254}
              required
            />
            <Input
              id="password"
              name="password"
              type="password"
              label={t("password")}
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 12 : 1}
              maxLength={register ? 72 : 128}
              aria-describedby={register ? "password-hint" : undefined}
              required
            />
            {register && <p id="password-hint">{t("passwordHint")}</p>}
            <Button disabled={pending}>
              {t(
                pending
                  ? register
                    ? "signingUp"
                    : "signingIn"
                  : register
                    ? "signUp"
                    : "signIn",
              )}
            </Button>
          </PreservedForm>
        </CardContent>
        <CardFooter className="stack">
          <Link href="/guest" className="secondary-link auth-guest-link">
            {guest("continue")}
          </Link>
          {!register && (
            <Link href="/forgot-password">{t("forgotPassword")}</Link>
          )}
          <p>
            {t(register ? "hasAccount" : "noAccount")}{" "}
            <Link
              href={{
                pathname: register ? "/login" : "/register",
                query: { next },
              }}
            >
              {t(register ? "signIn" : "signUp")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
