import "server-only";

import type { ContactSheet, OutreachChannel, OutreachRecord } from "@/lib/outreach";
import { buildContactSheet, composeOutreachDraft } from "@/lib/outreach";
import {
  getBusinessProfileRepository,
  getLeadRepository,
  getOutreachRepository,
  type OutreachUpdate,
} from "@/server/repo";

import { LeadNotFoundError } from "./service-errors";

/**
 * Outreach: prepare, record, and never send.
 *
 * ── THERE IS NO SEND FUNCTION IN THIS FILE ────────────────────────────────
 *
 * Not "not yet" -- there is no transport imported, no address the application
 * could deliver to, and no queue anything drains. What this service does is
 * assemble what a human needs in order to make contact themselves: the ways we
 * know to reach a business, where each of those came from, and a draft opening
 * they can edit. Everything after that is a person, and `markSent` records
 * their report of what they did.
 *
 * The lead is loaded from the database. A caller supplies an identity and,
 * at most, their own words -- never facts about the business.
 */

export { LeadNotFoundError } from "./service-errors";

export interface OutreachView {
  sheet: ContactSheet;
  records: OutreachRecord[];
  /** Channels a draft could be written for right now. */
  availableChannels: OutreachChannel[];
}

/** What we hold for one lead, plus every outreach record written for it. */
export async function outreachForLead(leadId: string): Promise<OutreachView> {
  const lead = await getLeadRepository().findById(leadId);
  if (!lead) throw new LeadNotFoundError(leadId);

  // The latest research run, when there is one. A lead that has never been
  // researched still has a contact sheet -- it is just the discovery record.
  const profile = await getBusinessProfileRepository().latestForLead(leadId);
  const sheet = buildContactSheet(lead, profile);
  const records = await getOutreachRepository().listForLead(leadId);

  return {
    sheet,
    records,
    availableChannels: [...new Set(sheet.points.map((p) => p.channel))],
  };
}

/**
 * Write a draft for one channel.
 *
 * The words are composed here from sourced facts, deterministically. A caller
 * may supply their own body instead -- a human writing their own opening is the
 * point of the feature -- but never facts about the business: everything the
 * draft asserts comes from the lead and its profile, read here.
 */
export async function draftOutreach(
  leadId: string,
  channel: OutreachChannel,
  overrides: { body?: string; subject?: string | null } = {},
): Promise<OutreachRecord> {
  const lead = await getLeadRepository().findById(leadId);
  if (!lead) throw new LeadNotFoundError(leadId);

  const profile = await getBusinessProfileRepository().latestForLead(leadId);
  const sheet = buildContactSheet(lead, profile);
  const composed = composeOutreachDraft(lead, sheet, channel);

  return getOutreachRepository().create(leadId, {
    channel,
    // The contact we would use, copied now so the record says who was meant
    // even if a later research run changes what we hold.
    contact: composed.contact,
    subject: overrides.subject === undefined ? composed.subject : overrides.subject,
    body: overrides.body ?? composed.body,
  });
}

/**
 * Apply a human's changes to a record.
 *
 * Returns null when the id is unknown, which the route reports as a 404.
 */
export async function updateOutreach(
  id: string,
  changes: OutreachUpdate,
): Promise<OutreachRecord | null> {
  return getOutreachRepository().update(id, changes);
}

/**
 * Record that a PERSON sent this.
 *
 * A separate operation from `updateOutreach` on purpose. Marking something sent
 * is the one state change that asserts a thing happened in the world, and it
 * should be legible as its own act in the code -- not a status string that
 * happened to flow through a generic update. `at` is supplied by the caller,
 * because the person reporting it knows when they did it and the server does
 * not.
 */
export async function markSent(id: string, at: string): Promise<OutreachRecord | null> {
  return getOutreachRepository().update(id, { status: "sent", sentAt: at });
}
