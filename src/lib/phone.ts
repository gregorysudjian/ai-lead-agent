/**
 * Displaying and dialling a phone number a provider gave us.
 *
 * Overture writes the same Montreal number as "+15149491792" in one row and
 * "5147255273" in the next. Shown raw, a list of them is unreadable and looks
 * careless; formatted once, they read the way a local expects:
 * "(514) 949-1792".
 *
 * Only North American numbers are reformatted, and only when they are
 * unambiguously that: ten digits, or eleven starting with 1. Anything else is
 * shown exactly as the provider wrote it -- rewriting a number we do not
 * understand risks displaying a wrong one, which is worse than an ugly one.
 *
 * Pure and total.
 */

function nanpDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
}

/** "(514) 949-1792", or the original text when it is not a plain NANP number. */
export function formatPhone(raw: string): string {
  // An extension or several numbers in one field: show it as given.
  if (/[a-z]|[,;/]/i.test(raw)) return raw.trim();
  const digits = nanpDigits(raw);
  if (digits === null) return raw.trim();
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * A `tel:` href, or null when the number cannot be dialled with confidence.
 *
 * Null rather than a best guess: a link that dials the wrong business is a
 * worse outcome than no link.
 */
export function phoneHref(raw: string): string | null {
  if (/[a-z]|[,;/]/i.test(raw)) return null;
  const digits = nanpDigits(raw);
  return digits === null ? null : `tel:+1${digits}`;
}
