/**
 * Outreach: who we could contact, how, and what we mean to say.
 *
 * ── THE HARD RULE, RESTATED WHERE IT MATTERS ──────────────────────────────
 *
 * Nothing in this application sends anything. There is no email client, no SMS
 * gateway, no form filler, and no `send()` waiting to be wired up. A record
 * here is a DRAFT and a LOG: a human writes or approves the words, a human
 * contacts the business, and a human comes back and records what happened.
 * `sentAt` is a fact a person reports, not something code can cause.
 *
 * ── WHY THE CHANNEL COMES FIRST ───────────────────────────────────────────
 *
 * Most outreach tooling assumes email. This data does not support that. The
 * businesses worth approaching are the ones with no website, and a business
 * with no website has no homepage for us to read a `mailto:` from -- so the
 * email address does not exist anywhere in our records, and cannot. What we
 * actually hold is phone numbers, street addresses and social profiles. So a
 * contact point names its channel, and a draft is written for that channel.
 *
 * Pure module: no I/O, no clock, no randomness. Everything is a function of a
 * Lead and its profile.
 */
import type { BusinessProfile } from "./business-profile";
import { resolveField } from "./business-profile";
import type { Lead } from "./types";

export type OutreachChannel = "phone" | "email" | "social" | "in-person";

export const OUTREACH_CHANNEL_LABELS: Record<OutreachChannel, string> = {
  phone: "Phone",
  email: "Email",
  social: "Social profile",
  "in-person": "In person",
};

/**
 * How a contact detail reached us.
 *
 *   website    read from the business's own page. The strongest thing we have:
 *              they published it themselves, and we saw it.
 *   discovery  from the directory record that found them. Fine, but it is a
 *              copy of something else and can be stale -- the live Google
 *              lookup during research turned up a lead whose stored phone no
 *              longer matched the one the business advertises.
 */
export type ContactOrigin = "website" | "discovery";

export interface ContactPoint {
  channel: OutreachChannel;
  value: string;
  origin: ContactOrigin;
  /** Human-readable provenance, shown next to the value. */
  sourceLabel: string;
}

export interface ContactSheet {
  points: ContactPoint[];
  /** Channels we hold nothing for. Absence of a contact, never of a business. */
  missing: OutreachChannel[];
  /**
   * True when a research run actually read the business's own site.
   *
   * Distinct from "we have a website URL": the URL might be listed and dead.
   * Only a successful read sets this, and only this justifies writing anything
   * that refers to what is on their site.
   */
  websiteRead: boolean;
  /**
   * True when research looked for a website and found none.
   *
   * NOT "this business has no website". It means our search did not find one,
   * which is the only thing we are ever entitled to say.
   */
  noWebsiteFound: boolean;
}

const CHANNELS: readonly OutreachChannel[] = ["phone", "email", "social", "in-person"];

function push(points: ContactPoint[], point: ContactPoint | null): void {
  if (point === null) return;
  // A number listed identically by two sources is one way to reach them.
  if (points.some((p) => p.channel === point.channel && p.value === point.value)) return;
  points.push(point);
}

function usable(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Everything we could use to reach this business, with provenance.
 *
 * Reads the profile first, because a fact we read on the business's own page
 * outranks a directory's copy for contact details -- the same precedence
 * `resolveField` applies, for the same reason. The lead snapshot fills gaps.
 */
export function buildContactSheet(
  lead: Lead,
  profile: BusinessProfile | null,
): ContactSheet {
  const points: ContactPoint[] = [];

  if (profile) {
    const sourceLabelFor = (sourceId: string): string => {
      const source = profile.sources.find((s) => s.id === sourceId);
      if (!source) return "Unknown source";
      return source.title ?? source.reference;
    };
    const originFor = (sourceId: string): ContactOrigin =>
      profile.sources.find((s) => s.id === sourceId)?.type === "website"
        ? "website"
        : "discovery";

    for (const [field, channel] of [
      ["contact.phone", "phone"],
      ["contact.email", "email"],
      ["contact.address", "in-person"],
    ] as const) {
      const resolved = resolveField(profile.facts, field, profile.sources);
      const value = usable(resolved ? String(resolved.observation.value) : null);
      if (value === null || resolved === null) continue;

      push(points, {
        channel,
        value,
        origin: originFor(resolved.observation.sourceId),
        sourceLabel: sourceLabelFor(resolved.observation.sourceId),
      });
    }

    // Social profiles are a `multiple` field: several distinct handles, not a
    // conflict, so every one of them is a way to reach the business.
    for (const observation of profile.facts["web.socialLink"]) {
      push(points, {
        channel: "social",
        value: String(observation.value),
        origin: originFor(observation.sourceId),
        sourceLabel: sourceLabelFor(observation.sourceId),
      });
    }
  }

  // The discovery record fills anything research did not supply.
  push(
    points,
    usable(lead.provider.phone)
      ? {
          channel: "phone",
          value: lead.provider.phone as string,
          origin: "discovery",
          sourceLabel: "Discovery record",
        }
      : null,
  );
  push(
    points,
    usable(lead.provider.address)
      ? {
          channel: "in-person",
          value: lead.provider.address as string,
          origin: "discovery",
          sourceLabel: "Discovery record",
        }
      : null,
  );

  const webCoverage = profile?.coverage.find((c) => c.area === "web");
  const websiteRead =
    profile?.facts["web.reachable"].some((o) => o.value === true) === true;

  return {
    points,
    missing: CHANNELS.filter((channel) => !points.some((p) => p.channel === channel)),
    websiteRead,
    // Research ran, looked, and came back with nothing. Not the same as never
    // having looked, which is what `not-researched` with no profile means.
    noWebsiteFound:
      profile !== null && !websiteRead && webCoverage?.status !== "covered",
  };
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/**
 * Where one outreach attempt stands.
 *
 *   draft     written, not yet approved by a human
 *   approved  a human has read it and is willing to send it as written
 *   sent      a human reports having sent it. Code never sets this.
 *   replied   the business responded
 *   closed    finished, whatever the outcome
 */
export type OutreachStatus = "draft" | "approved" | "sent" | "replied" | "closed";

export const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = {
  draft: "Draft",
  approved: "Approved to send",
  sent: "Sent (recorded by hand)",
  replied: "Replied",
  closed: "Closed",
};

export const OUTREACH_STATUSES: readonly OutreachStatus[] = [
  "draft",
  "approved",
  "sent",
  "replied",
  "closed",
];

export interface OutreachRecord {
  id: string;
  leadId: string;
  channel: OutreachChannel;
  status: OutreachStatus;
  /** The contact actually intended, copied when the draft was made. */
  contact: string | null;
  /** Only meaningful for email. Null for every other channel. */
  subject: string | null;
  body: string;
  /** What a human reports happened. Free text, written by a person. */
  outcome: string | null;
  /**
   * When a HUMAN recorded having sent this.
   *
   * There is no code path that sets this as a side effect of sending, because
   * there is no sending.
   */
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachDraft {
  channel: OutreachChannel;
  contact: string | null;
  subject: string | null;
  body: string;
}

// ---------------------------------------------------------------------------
// Draft composition
// ---------------------------------------------------------------------------

/**
 * Compose an opening message from facts we can defend.
 *
 * Deterministic and template-based. No model is involved, and that is not a
 * placeholder: the failure mode of a generated opener is a confident sentence
 * about a business we cannot support, sent to that business. Every clause below
 * is either about US ("I could not find"), or a fact a source actually gave us.
 *
 * THE SENTENCE THIS WILL NOT WRITE: "I noticed you don't have a website."
 * A missing website in our records means no source listed one and our search
 * did not find one. Telling the owner they have none -- when they may well have
 * a Facebook page they consider their website -- is both wrong and the fastest
 * way to lose the conversation. The honest version is what we actually know:
 * we looked and could not find one.
 *
 * It is a starting point, not a finished message. A human edits it.
 */
export function composeOutreachDraft(
  lead: Lead,
  sheet: ContactSheet,
  channel: OutreachChannel,
): OutreachDraft {
  const name = lead.provider.name;
  const category = lead.provider.category.toLowerCase();
  const city = lead.provider.city;

  const contact =
    sheet.points.find((p) => p.channel === channel)?.value ?? null;

  const opening = sheet.websiteRead
    ? `I had a look at your website for ${name} and put together some ideas for what a refresh could do.`
    : `I tried to find a website for ${name} and could not turn one up — if you have one I have missed, tell me and I will happily look at that instead.`;

  const middle = `I build small websites for ${category}s around ${city}. Rather than send a pitch, I have put together a sample site for ${name} so you can see the idea rather than read about it.`;

  const close =
    channel === "phone"
      ? `Is now a good time, or should I call back?`
      : `If it is useful I will send the link. If not, no hard feelings — I will not follow up again.`;

  const body =
    channel === "phone"
      ? [
          `Hi, is the owner or manager available?`,
          ``,
          opening,
          ``,
          middle,
          ``,
          close,
        ].join("\n")
      : [`Hi ${name},`, ``, opening, ``, middle, ``, close, ``, `— sent by hand, not automated.`].join("\n");

  return {
    channel,
    contact,
    subject: channel === "email" ? `A sample website for ${name}` : null,
    body,
  };
}
