import { createCookie } from "react-router";
import Backend from "i18next-fs-backend";
import { resolve } from "node:path";
import { RemixI18Next } from "remix-i18next/server";
import * as i18n from "~/i18n";

export const localeCookie = createCookie("lng", {
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
});

export const remixI18Next = new RemixI18Next({
  detection: {
    supportedLanguages: [...i18n.supportedLngs],
    fallbackLanguage: i18n.fallbackLng,
    cookie: localeCookie,
  },
  i18next: {
    supportedLngs: [...i18n.supportedLngs],
    fallbackLng: i18n.fallbackLng,
    defaultNS: i18n.defaultNS,
    ns: i18n.ns,
    backend: {
      loadPath: resolve("./public/locales/{{lng}}/{{ns}}.json"),
    },
  },
  plugins: [Backend],
});
