"use server";

import { cookies } from "next/headers";

import { signIn, signOut } from "@/auth";
import { LOCALE_COOKIE_NAME, dictionaries, normalizeLocale } from "@/lib/i18n";

export async function loginAction(_: { error?: string } | undefined, formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");
  const localeFromForm = String(formData.get("locale") ?? "");
  const localeFromCookie = (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
  const locale = normalizeLocale(localeFromForm || localeFromCookie);

  try {
    await signIn("credentials", {
      identifier,
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof Error && "type" in error && error.type === "CredentialsSignin") {
      return { error: dictionaries[locale].login.invalidCredentials };
    }

    throw error;
  }

  return { success: true };
}

export async function logoutAction() {
  await signOut({
    redirectTo: "/login",
  });
}
