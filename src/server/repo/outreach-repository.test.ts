import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createOutreachRepository } from "./outreach-supabase";
import { InMemoryOutreachTableGateway } from "./outreach-table";
import { OutreachMappingError } from "./outreach-mapping";

/** In-memory gateway throughout: no network, no credentials, no database. */

const AT = new Date("2026-09-07T12:00:00.000Z");

const repo = (now: () => Date = () => AT) =>
  createOutreachRepository(new InMemoryOutreachTableGateway(), { now });

const draft = {
  channel: "phone" as const,
  contact: "+1 514 934 3300",
  subject: null,
  body: "Hi, is the owner available?",
};

describe("a draft is created unsent, and knows it", () => {
  it("stores the draft and stamps our own fields", async () => {
    const record = await repo().create("lead-1", draft);

    expect(record).toMatchObject({
      leadId: "lead-1",
      channel: "phone",
      status: "draft",
      contact: "+1 514 934 3300",
      outcome: null,
      sentAt: null,
      createdAt: AT.toISOString(),
    });
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("cannot be created already sent", async () => {
    // There is no path that could have sent it, so `sentAt` is null by
    // construction rather than by a default a caller could override.
    const record = await repo().create("lead-1", {
      ...draft,
      // @ts-expect-error -- proving the field is not part of the create contract
      sentAt: "2020-01-01T00:00:00.000Z",
      status: "sent",
    });

    expect(record.sentAt).toBeNull();
    expect(record.status).toBe("draft");
  });

  it("rejects a subject on a channel that has no subject", async () => {
    await expect(
      repo().create("lead-1", { ...draft, channel: "phone", subject: "Hello" }),
    ).rejects.toBeInstanceOf(OutreachMappingError);
  });

  it("accepts a subject on email", async () => {
    const record = await repo().create("lead-1", {
      ...draft,
      channel: "email",
      subject: "A sample website",
    });
    expect(record.subject).toBe("A sample website");
  });

  it("refuses an empty or oversized body", async () => {
    await expect(repo().create("lead-1", { ...draft, body: "" })).rejects.toThrow();
    await expect(
      repo().create("lead-1", { ...draft, body: "x".repeat(8001) }),
    ).rejects.toThrow();
  });

  it("refuses an unknown channel", async () => {
    await expect(
      // @ts-expect-error -- proving the runtime check, not the type
      repo().create("lead-1", { ...draft, channel: "carrier-pigeon" }),
    ).rejects.toBeInstanceOf(OutreachMappingError);
  });
});

describe("a human's changes are applied, and identity is not", () => {
  it("updates status, wording and outcome", async () => {
    const store = repo();
    const created = await store.create("lead-1", draft);

    const updated = await store.update(created.id, {
      status: "replied",
      body: "Rewritten by hand.",
      outcome: "Owner asked me to call back Thursday.",
    });

    expect(updated).toMatchObject({
      status: "replied",
      body: "Rewritten by hand.",
      outcome: "Owner asked me to call back Thursday.",
    });
  });

  it("never lets an update change the lead, the channel or the id", async () => {
    const store = repo();
    const created = await store.create("lead-1", draft);

    const updated = await store.update(created.id, {
      // @ts-expect-error -- these are deliberately absent from OutreachUpdate
      leadId: "lead-999",
      channel: "email",
      id: "somebody-elses-id",
      status: "approved",
    });

    // A record must keep naming the business it was written for.
    expect(updated).toMatchObject({
      id: created.id,
      leadId: "lead-1",
      channel: "phone",
      createdAt: created.createdAt,
    });
  });

  it("returns null for an unknown id rather than throwing", async () => {
    expect(await repo().update("no-such-id", { status: "closed" })).toBeNull();
  });

  it("re-validates wording on update, so an edit cannot store what a create refused", async () => {
    const store = repo();
    const created = await store.create("lead-1", draft);

    await expect(
      store.update(created.id, { body: "x".repeat(8001) }),
    ).rejects.toThrow();
  });

  it("moves updatedAt without touching createdAt", async () => {
    let clock = AT;
    const store = createOutreachRepository(new InMemoryOutreachTableGateway(), {
      now: () => clock,
    });
    const created = await store.create("lead-1", draft);

    clock = new Date("2026-09-08T09:00:00.000Z");
    const updated = await store.update(created.id, { status: "approved" });

    expect(updated?.createdAt).toBe(AT.toISOString());
    expect(updated?.updatedAt).toBe(clock.toISOString());
  });
});

describe("sent is something a person reports", () => {
  it("records the moment the caller supplies", async () => {
    const store = repo();
    const created = await store.create("lead-1", draft);

    const at = "2026-09-09T15:30:00.000Z";
    const updated = await store.update(created.id, { status: "sent", sentAt: at });

    expect(updated).toMatchObject({ status: "sent", sentAt: at });
  });

  it("does not stamp sentAt as a side effect of any other change", async () => {
    const store = repo();
    const created = await store.create("lead-1", draft);

    for (const status of ["approved", "replied", "closed"] as const) {
      const updated = await store.update(created.id, { status });
      expect(updated?.sentAt, status).toBeNull();
    }
  });
});

describe("reading back", () => {
  it("lists a lead's records newest first", async () => {
    let clock = AT;
    const store = createOutreachRepository(new InMemoryOutreachTableGateway(), {
      now: () => clock,
    });

    await store.create("lead-1", draft);
    clock = new Date("2026-09-08T00:00:00.000Z");
    const second = await store.create("lead-1", { ...draft, body: "Second" });
    await store.create("lead-2", draft);

    const list = await store.listForLead("lead-1");
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(second.id);
  });

  it("refuses a nonsense limit", async () => {
    await expect(repo().listRecent(0)).rejects.toThrow();
    await expect(repo().listRecent(1.5)).rejects.toThrow();
  });
});

describe("nothing in this application sends anything", () => {
  const listFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? listFiles(full) : [full];
    });

  it("imports no mail, SMS or messaging transport anywhere", () => {
    // The hard rule, enforced rather than remembered. If one of these ever
    // appears, this test is the thing that has to be argued with first.
    const forbidden = [
      "nodemailer",
      "@sendgrid",
      "postmark",
      "mailgun",
      "resend",
      "twilio",
      "@aws-sdk/client-ses",
      "smtp",
    ];

    const offenders: string[] = [];
    for (const file of listFiles(join(process.cwd(), "src"))) {
      if (!/\.tsx?$/.test(file)) continue;
      // This file names every transport in order to forbid it.
      if (file.endsWith("outreach-repository.test.ts")) continue;
      const source = readFileSync(file, "utf8").toLowerCase();
      for (const name of forbidden) {
        if (source.includes(`"${name}`) || source.includes(`'${name}`)) {
          offenders.push(`${file}: ${name}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("has no dependency that could deliver a message", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(" ");

    for (const name of ["nodemailer", "sendgrid", "postmark", "mailgun", "twilio", "resend"]) {
      expect(deps, name).not.toContain(name);
    }
  });

  it("exposes no send operation on the repository", () => {
    const contract = readFileSync(
      join(process.cwd(), "src", "server", "repo", "outreach-types.ts"),
      "utf8",
    );
    expect(contract).not.toMatch(/\bsend\s*\(/);
    // And no delete: an outreach record is the log of a business having been
    // approached, including so a request not to be contacted can be honoured.
    expect(contract).not.toMatch(/\bdelete\s*\(/);
  });
});
