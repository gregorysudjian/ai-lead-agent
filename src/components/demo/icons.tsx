import type { ReactNode } from "react";

/**
 * Line icons for demo sites.
 *
 * ── WHY INLINE SVG ────────────────────────────────────────────────────────
 *
 * No icon package and no external requests. A demo page fetches nothing from
 * a third party -- the CSP of the eventual deployment, the offline-first
 * development story and the "we do not fetch imagery of a business we have
 * never seen" rule all point the same way. Twenty paths do not justify a
 * dependency.
 *
 * ── WHY ICONS AT ALL ──────────────────────────────────────────────────────
 *
 * The services list used to be numbered circles: 1, 2, 3. Numbering implies a
 * sequence that does not exist -- a salon's colour service does not follow its
 * cuts -- and it is the single most generated-looking element on the page. An
 * icon that matches the service reads as a page someone designed.
 *
 * ── HOW ONE IS CHOSEN ─────────────────────────────────────────────────────
 *
 * By keyword, in the RENDERER, from the service title. Deliberately not a
 * field a generator fills in: adding one to the schema would mean every
 * already-stored demo lacked it, and it would hand a model one more thing to
 * get subtly wrong. Keywords are matched most-specific first, and anything
 * unrecognised falls back to a neutral mark rather than a wrong picture --
 * a tooth icon on a florist's delivery service is worse than a plain dot.
 */

export type IconName =
  | "scissors"
  | "razor"
  | "sparkle"
  | "droplet"
  | "hand"
  | "flower"
  | "cup"
  | "utensils"
  | "bread"
  | "cake"
  | "tooth"
  | "cross"
  | "heart"
  | "dumbbell"
  | "wrench"
  | "car"
  | "calendar"
  | "clock"
  | "gift"
  | "truck"
  | "users"
  | "shield"
  | "camera"
  | "star"
  | "tag"
  | "chat"
  | "building"
  | "dot";

/**
 * The paths, drawn on a 24x24 grid and stroked rather than filled.
 *
 * Stroked so a single `currentColor` and one stroke width keep every icon
 * visually consistent, whatever theme colour it inherits.
 */
const PATHS: Record<IconName, ReactNode> = {
  scissors: (
    <>
      <circle cx="6.5" cy="19" r="2.2" />
      <circle cx="17.5" cy="19" r="2.2" />
      <path d="M8 17.2 18 4.5M16 17.2 6 4.5" />
    </>
  ),
  razor: (
    <>
      <rect x="5" y="3" width="14" height="4.5" rx="1.2" />
      <path d="M12 7.5V21" />
    </>
  ),
  sparkle: <path d="M12 2.5 13.7 10.3 21.5 12 13.7 13.7 12 21.5 10.3 13.7 2.5 12 10.3 10.3Z" />,
  droplet: <path d="M12 21a6 6 0 0 1-6-6c0-4 6-12 6-12s6 8 6 12a6 6 0 0 1-6 6Z" />,
  hand: (
    <>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0 0V4.5a1.5 1.5 0 0 1 3 0V11m0 0V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7 7 7 0 0 1-7-7v-2.5a1.5 1.5 0 0 1 3 0V13" />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="12" cy="6.5" r="2.6" />
      <circle cx="12" cy="17.5" r="2.6" />
      <circle cx="6.5" cy="12" r="2.6" />
      <circle cx="17.5" cy="12" r="2.6" />
    </>
  ),
  cup: (
    <>
      <path d="M4 8h12v6a6 6 0 0 1-12 0Z" />
      <path d="M16 9.5h1.8a2.2 2.2 0 0 1 0 4.4H16" />
      <path d="M3 21h14" />
    </>
  ),
  utensils: (
    <>
      <path d="M7 3v6a2 2 0 0 0 4 0V3M9 9v12" />
      <path d="M17.5 3c1.8 3 1.8 6 0 9v9" />
    </>
  ),
  bread: (
    <>
      <path d="M4 12a8 4.5 0 0 1 16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M9 12.5v6M13 12.5v6" />
    </>
  ),
  cake: (
    <>
      <path d="M4 20v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6Z" />
      <path d="M3 20h18M12 12V8" />
      <circle cx="12" cy="6" r="1.4" />
    </>
  ),
  tooth: (
    <path d="M12 3c-2.5 0-3.5 1-5.5 1C4.6 4 3.5 5.6 3.5 8.5c0 4 1.8 12.5 3.8 12.5 1.5 0 1.4-4.5 4.7-4.5s3.2 4.5 4.7 4.5c2 0 3.8-8.5 3.8-12.5C20.5 5.6 19.4 4 17.5 4 15.5 4 14.5 3 12 3Z" />
  ),
  cross: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  heart: (
    <path d="M12 20.5S4.5 16 4.5 10.8A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7.5 2.8c0 5.2-7.5 9.7-7.5 9.7Z" />
  ),
  dumbbell: (
    <>
      <rect x="2.5" y="9" width="3.5" height="6" rx="1" />
      <rect x="18" y="9" width="3.5" height="6" rx="1" />
      <path d="M6 12h12" />
    </>
  ),
  wrench: (
    <path d="M14.8 6.2a4.2 4.2 0 1 0 5.2 5.2L9.8 21.6a2.2 2.2 0 0 1-3.1-3.1Z" />
  ),
  car: (
    <>
      <path d="M4 16v-3l2-5.5h12L20 13v3" />
      <path d="M3 16h18" />
      <circle cx="7.5" cy="17.8" r="1.8" />
      <circle cx="16.5" cy="17.8" r="1.8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.3l3.2 2" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="9" width="17" height="11.5" rx="1.5" />
      <path d="M3.5 13.5h17M12 9v11.5" />
      <path d="M12 9C10 4.8 4.5 5.2 5.5 8c.6 1.6 4 1 6.5 1 2.5 0 5.9.6 6.5-1 1-2.8-4.5-3.2-6.5 1Z" />
    </>
  ),
  truck: (
    <>
      <path d="M2.5 6.5h11v10h-11ZM13.5 10h4l3 3.2v3.3h-7Z" />
      <circle cx="6.5" cy="18" r="1.8" />
      <circle cx="16.5" cy="18" r="1.8" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.6M18 14.2a5.5 5.5 0 0 1 3.5 5.1" />
    </>
  ),
  shield: <path d="M12 3 20 6v6.2c0 4.8-3.6 7.8-8 8.8-4.4-1-8-4-8-8.8V6Z" />,
  camera: (
    <>
      <rect x="2.5" y="7" width="19" height="13.5" rx="2.5" />
      <circle cx="12" cy="13.8" r="3.6" />
      <path d="M8.5 7 10 4h4l1.5 3" />
    </>
  ),
  star: (
    <path d="M12 3.5 14.6 9.1 20.7 9.9 16.3 14.2 17.3 20.3 12 17.4 6.7 20.3 7.7 14.2 3.3 9.9 9.4 9.1Z" />
  ),
  tag: (
    <>
      <path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8.5 8.5-9 9Z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </>
  ),
  chat: <path d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 16H9.5L4 20.5Z" />,
  building: (
    <>
      <path d="M4 21V9l8-6 8 6v12" />
      <path d="M2.5 21h19M9.5 21v-6h5v6" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="4.5" />,
};

/**
 * Keyword to icon, checked in order so the specific wins.
 *
 * "hot towel shave" must reach `razor` before "towel" reaches anything else,
 * and "kids cuts" must reach `users` rather than `scissors`, so ordering here
 * is meaningful rather than incidental.
 *
 * French keywords sit beside their English ones: a French page's "Taille de
 * barbe" must get the razor its English twin "Beard trims" gets, and a test
 * checks every pair in the sample copy. Accents are kept -- titles are
 * compared lower-cased, not stripped.
 */
const KEYWORDS: readonly [string, IconName][] = [
  // Before "repair" and "soin": nail care is not a garage, nor a facial.
  ["care and repair", "hand"],
  ["soins et réparation", "hand"],
  ["kids", "users"],
  ["children", "users"],
  ["enfant", "users"],
  ["groupe", "users"],
  ["mariage", "heart"],
  ["événement", "sparkle"],
  ["rasage", "razor"],
  ["barbe", "razor"],
  ["line-up", "razor"],
  ["contour", "razor"],
  ["fade", "scissors"],
  ["dégradé", "scissors"],
  ["highlight", "droplet"],
  ["balayage", "droplet"],
  ["mèches", "droplet"],
  ["blow-dry", "sparkle"],
  ["mise en plis", "sparkle"],
  ["makeup", "sparkle"],
  ["maquillage", "sparkle"],
  ["french", "hand"],
  ["tattoo", "star"],
  ["tatouage", "star"],
  // "retouche" contains "touch", which would otherwise make it a chat bubble.
  ["cover-up", "star"],
  ["recouvrement", "star"],
  // Before "rallonge": "Gel et rallonges" is "Gel and extensions".
  ["gel", "droplet"],
  ["flash", "sparkle"],
  ["piercing", "sparkle"],
  ["perçage", "sparkle"],
  ["consultation", "chat"],
  ["coupe", "scissors"],
  ["coiffage", "scissors"],
  ["couleur", "droplet"],
  ["soin", "sparkle"],
  ["épilation", "droplet"],
  ["sourcil", "sparkle"],
  ["manucure", "hand"],
  ["pédicure", "hand"],
  ["rallonge", "hand"],
  ["sur place", "utensils"],
  ["emporter", "truck"],
  ["livraison", "truck"],
  ["café", "cup"],
  ["déjeuner", "cup"],
  ["viennoiserie", "bread"],
  ["pain", "bread"],
  ["gâteau", "cake"],
  ["commande", "tag"],
  ["examen", "tooth"],
  ["hygiène", "sparkle"],
  ["esthétique", "sparkle"],
  ["traitement", "sparkle"],
  ["ordonnance", "cross"],
  ["conseil", "chat"],
  ["santé", "cross"],
  ["abonnement", "tag"],
  ["cours", "users"],
  ["entraînement", "dumbbell"],
  ["commencer", "star"],
  ["condoléance", "heart"],
  ["fleur", "flower"],
  ["entretien", "wrench"],
  ["réparation", "wrench"],
  ["pneu", "car"],
  ["frein", "car"],
  ["rendez-vous", "calendar"],
  ["nous joindre", "chat"],
  // English "Somewhere to work" reaches "where" below.
  ["place pour travailler", "building"],
  ["comment ça marche", "star"],
  ["family", "users"],
  ["group", "users"],
  ["team", "users"],
  ["wedding", "heart"],
  ["occasion", "sparkle"],
  ["event", "sparkle"],
  ["shave", "razor"],
  ["beard", "razor"],
  ["cut", "scissors"],
  ["style", "scissors"],
  ["styling", "scissors"],
  ["colour", "droplet"],
  ["color", "droplet"],
  ["treatment", "sparkle"],
  ["facial", "sparkle"],
  ["wax", "droplet"],
  ["brow", "sparkle"],
  ["lash", "sparkle"],
  ["massage", "heart"],
  ["manicure", "hand"],
  ["pedicure", "hand"],
  ["nail art", "sparkle"],
  ["nail", "hand"],
  ["gel", "droplet"],
  ["extension", "hand"],
  ["menu", "utensils"],
  ["dining", "utensils"],
  ["dine", "utensils"],
  ["kitchen", "utensils"],
  ["takeaway", "truck"],
  ["delivery", "truck"],
  ["coffee", "cup"],
  ["breakfast", "cup"],
  ["lunch", "utensils"],
  ["bread", "bread"],
  ["pastr", "bread"],
  ["cake", "cake"],
  ["order", "tag"],
  ["check-up", "tooth"],
  ["check up", "tooth"],
  ["hygiene", "sparkle"],
  ["cosmetic", "sparkle"],
  ["dental", "tooth"],
  ["prescription", "cross"],
  ["advice", "chat"],
  ["health", "cross"],
  ["everyday", "cross"],
  ["membership", "tag"],
  ["class", "users"],
  ["personal training", "dumbbell"],
  ["training", "dumbbell"],
  ["getting started", "star"],
  ["bouquet", "flower"],
  ["sympathy", "heart"],
  ["flower", "flower"],
  ["servicing", "wrench"],
  ["service", "wrench"],
  ["repair", "wrench"],
  ["inspection", "shield"],
  ["tyre", "car"],
  ["tire", "car"],
  ["brake", "car"],
  ["appointment", "calendar"],
  ["booking", "calendar"],
  ["hours", "clock"],
  ["gift", "gift"],
  ["photo", "camera"],
  ["gallery", "camera"],
  ["contact", "chat"],
  ["touch", "chat"],
  ["find us", "building"],
  ["where", "building"],
  ["how it works", "star"],
];

/**
 * The icon for a service title.
 *
 * Falls back to a neutral mark rather than guessing. A wrong picture -- a
 * tooth beside a florist's delivery service -- is worse than a plain dot,
 * because it is the kind of detail that tells an owner nobody looked.
 */
export function iconForService(title: string): IconName {
  const needle = title.trim().toLowerCase();
  for (const [keyword, icon] of KEYWORDS) {
    if (needle.includes(keyword)) return icon;
  }
  return "dot";
}

export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
