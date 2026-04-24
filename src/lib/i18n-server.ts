import { cookies } from "next/headers";

import { dictionaries, LOCALE_COOKIE_NAME, normalizeLocale } from "@/lib/i18n";

export async function getRequestI18n() {
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE_NAME)?.value);
  const messages = dictionaries[locale];

  return {
    locale,
    messages,
  };
}

