/**
 * The languages a demo site is written in.
 *
 * French first. Quebec's Charter of the French language requires a Quebec
 * business's website to be available in French, with French at least as
 * prominent as any other language, so a demo for a Montreal business opens in
 * French and offers English one click away.
 *
 * Lives in `lib` because both the generator (which writes copy per language)
 * and the renderer (which labels its own chrome per language) need it.
 */
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

/** Any value to a supported locale; everything unrecognised is French. */
export function asLocale(value: unknown): Locale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}
