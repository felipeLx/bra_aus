export const supportedLngs = ["en", "pt-BR"] as const;
export type SupportedLng = (typeof supportedLngs)[number];
export const fallbackLng = "en";
export const defaultNS = "translation";
export const ns = [defaultNS];
