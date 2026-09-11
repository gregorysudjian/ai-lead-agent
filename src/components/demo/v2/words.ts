import type { DemoSectionKind } from "@/lib/demo-site";

/**
 * The renderer's own words, in both languages.
 *
 * Only the words the PAGE says -- labels, the sample tag, "Menu". Everything
 * written about the business comes from the generator's copy, in the language
 * requested. Kept apart because the two have different owners: these are ours
 * and never change per business; that copy is a proposal and is marked sample.
 *
 * French is the default. Quebec's Charter of the French language requires a
 * Quebec business's website to be available in French with French at least as
 * prominent, so a demo for a Montreal business opens in French.
 */

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

export function asLocale(value: unknown): Locale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}

export interface Words {
  sample: string;
  sampleTitle: string;
  menu: string;
  close: string;
  phone: string;
  address: string;
  hours: string;
  follow: string;
  toBeAdded: string;
  pages: string;
  contact: string;
  photoSlot: string;
  scroll: string;
  switchTo: string;
  languageName: string;
  sectionLabel: Record<DemoSectionKind, string>;
  photoLabels: readonly string[];
  inCity: (city: string) => string;
  rights: string;
  /** The licence credit each discovery source requires, in this language. */
  credit: { osm: string; overture: string };
}

export const WORDS: Record<Locale, Words> = {
  fr: {
    sample: "Contenu d'exemple",
    sampleTitle: "Texte d'exemple, à confirmer avec le propriétaire",
    menu: "Menu",
    close: "Fermer",
    phone: "Téléphone",
    address: "Adresse",
    hours: "Heures d'ouverture",
    follow: "Suivez-nous",
    toBeAdded: "À ajouter",
    pages: "Pages",
    contact: "Contact",
    photoSlot: "Votre photo ici",
    scroll: "Défiler",
    switchTo: "English",
    languageName: "Français",
    sectionLabel: {
      hero: "Accueil",
      offering: "Services",
      positioning: "À propos",
      gallery: "Galerie",
      contact: "Nous trouver",
      cta: "Bienvenue",
    },
    photoLabels: ["La devanture", "L'intérieur", "Le travail", "L'équipe à l'œuvre", "Les détails", "L'ambiance"],
    inCity: (city) => `à ${city}`,
    rights: "Proposition de site web",
    credit: {
      osm: "Données © les contributeurs d'OpenStreetMap (ODbL)",
      overture: "Données : Overture Maps Foundation (CDLA-Permissive 2.0)",
    },
  },
  en: {
    sample: "Sample content",
    sampleTitle: "Sample copy, to be confirmed with the owner",
    menu: "Menu",
    close: "Close",
    phone: "Phone",
    address: "Address",
    hours: "Opening hours",
    follow: "Follow",
    toBeAdded: "To be added",
    pages: "Pages",
    contact: "Contact",
    photoSlot: "Your photo here",
    scroll: "Scroll",
    switchTo: "Français",
    languageName: "English",
    sectionLabel: {
      hero: "Home",
      offering: "Services",
      positioning: "About",
      gallery: "Gallery",
      contact: "Find us",
      cta: "Welcome",
    },
    photoLabels: ["The storefront", "Inside", "The work", "The team at work", "The details", "The feel"],
    inCity: (city) => `in ${city}`,
    rights: "Website proposal",
    credit: {
      osm: "Data © OpenStreetMap contributors (ODbL)",
      overture: "Data: Overture Maps Foundation (CDLA-Permissive 2.0)",
    },
  },
};

const FR_DAYS: Record<string, string> = {
  monday: "lundi",
  tuesday: "mardi",
  wednesday: "mercredi",
  thursday: "jeudi",
  friday: "vendredi",
  saturday: "samedi",
  sunday: "dimanche",
};

/**
 * The sample schedule, in the page's language.
 *
 * The sample schedules in `demo-samples.ts` are written in one simple English
 * shape -- "Monday to Friday   9:00 - 18:30", "Sunday   Closed" -- so French is
 * a deterministic rewrite rather than a second copy that could drift: day
 * names, "to"/"and", "Closed", and Quebec's "9 h – 18 h 30" time style.
 * It is still SAMPLE content and is always tagged as such where it appears.
 */
export function localizeScheduleLine(line: string, locale: Locale): string {
  if (locale === "en") return line;
  let out = line.toLowerCase();
  for (const [en, fr] of Object.entries(FR_DAYS)) out = out.replaceAll(en, fr);
  out = out
    .replace(/\bto\b/g, "au")
    .replace(/\band\b/g, "et")
    .replace(/\bclosed\b/g, "fermé")
    .replace(/(\d{1,2}):(\d{2})/g, (_m, h: string, mm: string) => (mm === "00" ? `${Number(h)} h` : `${Number(h)} h ${mm}`))
    .replace(/\s-\s/g, " – ");
  return out.charAt(0).toUpperCase() + out.slice(1);
}
