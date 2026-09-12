"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  OUTREACH_CHANNEL_LABELS,
  OUTREACH_STATUS_LABELS,
  type ContactPoint,
  type ContactSheet,
  type OutreachChannel,
  type OutreachRecord,
  type OutreachStatus,
} from "@/lib/outreach";
import { formatPhone } from "@/lib/phone";

import {
  Badge,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  Card,
  LINK,
  SectionHeading,
  type BadgeTone,
} from "./ui/primitives";
import { Timestamp } from "./ui/timestamp";

/**
 * Contact sheet and outreach drafts.
 *
 * NOTHING HERE SENDS ANYTHING. There is no send button, because there is no
 * send implementation behind it. The panel gives a person the ways we know to
 * reach a business, where each one came from, and a draft they can edit --
 * then records what they say they did about it.
 *
 * A Client Component: it owns form state and request lifecycle, and calls
 * router.refresh() so the server stays the source of truth.
 */

const STATUS_TONES: Record<OutreachStatus, BadgeTone> = {
  draft: "slate",
  approved: "indigo",
  sent: "emerald",
  replied: "emerald",
  closed: "slate",
};

const CHANNEL_TONES: Record<OutreachChannel, BadgeTone> = {
  phone: "emerald",
  email: "indigo",
  social: "indigo",
  "in-person": "amber",
};

export function OutreachPanel({
  leadId,
  sheet,
  records,
}: {
  leadId: string;
  sheet: ContactSheet;
  records: OutreachRecord[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const channels = [...new Set(sheet.points.map((p) => p.channel))];

  async function draft(channel: OutreachChannel) {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(typeof body?.error === "string" ? body.error : "Could not write a draft.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: OutreachStatus) {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/outreach/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        setError("Could not update the record.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" className="p-5">
      <SectionHeading
        title="Outreach"
        hint="This app never sends anything: you reach out yourself, then record what happened here."
      />

      <ContactSheetView sheet={sheet} />

      <div className="mt-4">
        <h3 className="text-sm font-medium">Write a draft</h3>
        {channels.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            No contact details yet. Run research, or add a source that can supply one.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {channels.map((channel) => (
              <button
                key={channel}
                type="button"
                onClick={() => draft(channel)}
                disabled={busy}
                className={BUTTON_PRIMARY}
              >
                {OUTREACH_CHANNEL_LABELS[channel]}
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
        >
          {error}
        </p>
      ) : null}

      {records.length > 0 ? (
        <ul className="mt-5 space-y-4">
          {records.map((record) => (
            <RecordView
              key={record.id}
              record={record}
              busy={busy}
              onStatus={(status) => setStatus(record.id, status)}
            />
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function ContactSheetView({ sheet }: { sheet: ContactSheet }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium">How we could reach them</h3>

      {sheet.points.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Nothing on file. That is a gap in our records, not a fact about the business.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {sheet.points.map((point, i) => (
            <ContactPointRow key={`${point.channel}-${i}`} point={point} />
          ))}
        </ul>
      )}

      {sheet.missing.length > 0 ? (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          Nothing on file for: {sheet.missing.map((c) => OUTREACH_CHANNEL_LABELS[c]).join(", ")}.
        </p>
      ) : null}

      {/* "No website found" is said once, in the research panel above, in
          the researcher's own words -- not again here. */}
    </div>
  );
}

function ContactPointRow({ point }: { point: ContactPoint }) {
  const isLink = point.channel === "social";

  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <Badge tone={CHANNEL_TONES[point.channel]}>
        {OUTREACH_CHANNEL_LABELS[point.channel]}
      </Badge>
      {isLink ? (
        <a
          href={point.value}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={LINK}
        >
          {point.value}
        </a>
      ) : (
        <span className="font-medium">
          {point.channel === "phone" ? formatPhone(point.value) : point.value}
        </span>
      )}
      <span className="text-xs text-slate-600 dark:text-slate-400">
        {point.origin === "website" ? "from their own site" : "from the discovery record"} ·{" "}
        {point.sourceLabel}
      </span>
    </li>
  );
}

function RecordView({
  record,
  busy,
  onStatus,
}: {
  record: OutreachRecord;
  busy: boolean;
  onStatus: (status: OutreachStatus) => void;
}) {
  return (
    <li className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={CHANNEL_TONES[record.channel]}>
          {OUTREACH_CHANNEL_LABELS[record.channel]}
        </Badge>
        <Badge tone={STATUS_TONES[record.status]}>
          {OUTREACH_STATUS_LABELS[record.status]}
        </Badge>
        {record.contact ? (
          <span className="text-xs text-slate-600 dark:text-slate-400">
            to {record.contact}
          </span>
        ) : null}
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          <Timestamp iso={record.createdAt} />
        </span>
      </div>

      {record.subject ? (
        <p className="mt-2 text-sm font-medium">{record.subject}</p>
      ) : null}

      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm dark:bg-slate-900">
        {record.body}
      </pre>

      {record.sentAt ? (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          You recorded sending this on <Timestamp iso={record.sentAt} />.
        </p>
      ) : null}

      {record.outcome ? (
        <p className="mt-2 text-sm">
          <span className="text-xs text-slate-600 dark:text-slate-400">Outcome: </span>
          {record.outcome}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {/* Every one of these records something a PERSON did. None of them
            causes a message to leave this machine, because nothing can. */}
        {(["approved", "sent", "replied", "closed"] as const)
          .filter((status) => status !== record.status)
          .map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => onStatus(status)}
              disabled={busy}
              className={BUTTON_SECONDARY}
            >
              {status === "sent" ? "I sent this" : `Mark ${status}`}
            </button>
          ))}
      </div>
    </li>
  );
}
