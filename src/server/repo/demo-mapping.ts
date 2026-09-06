/**
 * Explicit mapping between `demo_sites` rows and the `DemoSite` domain type.
 *
 * `jsonb` guarantees only that a value is JSON. It says nothing about whether
 * the document matches our schema, so every field is checked on the way out —
 * a spec written by an older version of the generator, or by a future model,
 * has to satisfy the same rules before it can reach a renderer.
 *
 * The validation is also the enforcement point for the two safety rules:
 *
 *   1. Enums are closed. A theme, a section kind and a CTA action must be one
 *      of the values this application designed. An unknown value is rejected,
 *      not rendered.
 *   2. There is no field anywhere in this schema that holds a URL, markup or a
 *      style. A generator cannot express one, so a renderer never has to
 *      decide whether to trust one.
 *
 * Pure, no I/O, no secrets, so it is directly unit-testable.
 */
import type {
  DemoCta,
  DemoNavItem,
  DemoOfferingItem,
  DemoPlaceholder,
  DemoSection,
  DemoSite,
  DemoSiteBusiness,
  DemoSiteContent,
  DemoSiteDraft,
  DemoSiteSpec,
  DemoSiteStatus,
  DemoTheme,
} from "@/lib/demo-site";
import { DEMO_THEME_LABELS } from "@/lib/demo-site";
import type { BusinessSource } from "@/lib/types";

/** The `demo_sites` table shape. Database implementation detail. */
export interface DemoSiteRow {
  id: string;
  lead_id: string;
  analysis_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  generator_name: string;
  generator_model: string;
  spec: unknown;
}

export class DemoSiteRowMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoSiteRowMappingError";
  }
}

function fail(field: string, why: string): never {
  throw new DemoSiteRowMappingError(`Demo site field "${field}" ${why}.`);
}

function obj(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(field, "is not an object");
  }
  return value as Record<string, unknown>;
}

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(field, "is missing or not a non-empty string");
  }
  return value as string;
}

function strOrNull(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return str(value, field);
}

function bool(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") fail(field, "must be a boolean");
  return value;
}

function list<T>(value: unknown, field: string, each: (v: unknown, f: string) => T): T[] {
  if (!Array.isArray(value)) fail(field, "must be an array");
  return value.map((entry, i) => each(entry, `${field}[${i}]`));
}

function nonEmptyList<T>(
  value: unknown,
  field: string,
  each: (v: unknown, f: string) => T,
): T[] {
  const items = list(value, field, each);
  if (items.length === 0) fail(field, "must not be empty");
  return items;
}

const SOURCES: readonly string[] = ["mock", "osm", "google"];
const CTA_ACTIONS: readonly string[] = ["call", "directions", "scroll"];

/**
 * Section ids double as HTML anchor fragments, so they are restricted to a
 * conservative slug. That keeps a stored id from becoming anything a browser
 * could interpret as more than a fragment name.
 */
function sectionId(value: unknown, field: string): string {
  const id = str(value, field);
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(id)) {
    fail(field, "must be a lowercase slug of letters, digits and hyphens");
  }
  return id;
}

function toBusiness(value: unknown): DemoSiteBusiness {
  const b = obj(value, "spec.business");

  const source = str(b.source, "spec.business.source");
  if (!SOURCES.includes(source)) fail("spec.business.source", "has an unknown value");

  return {
    name: str(b.name, "spec.business.name"),
    category: str(b.category, "spec.business.category"),
    city: str(b.city, "spec.business.city"),
    phone: strOrNull(b.phone, "spec.business.phone"),
    address: strOrNull(b.address, "spec.business.address"),
    websiteListed: bool(b.websiteListed, "spec.business.websiteListed"),
    source: source as BusinessSource,
    snapshotFetchedAt: str(b.snapshotFetchedAt, "spec.business.snapshotFetchedAt"),
  };
}

function toCta(value: unknown, field: string): DemoCta {
  const c = obj(value, field);

  const action = str(c.action, `${field}.action`);
  if (!CTA_ACTIONS.includes(action)) fail(`${field}.action`, "is not a known CTA action");

  const cta: DemoCta = {
    label: str(c.label, `${field}.label`),
    action: action as DemoCta["action"],
  };

  if (c.targetSectionId !== undefined && c.targetSectionId !== null) {
    cta.targetSectionId = sectionId(c.targetSectionId, `${field}.targetSectionId`);
  }
  if (cta.action === "scroll" && cta.targetSectionId === undefined) {
    fail(`${field}.targetSectionId`, "is required for a scroll action");
  }
  return cta;
}

function toNavItem(value: unknown, field: string): DemoNavItem {
  const n = obj(value, field);
  return {
    label: str(n.label, `${field}.label`),
    targetSectionId: sectionId(n.targetSectionId, `${field}.targetSectionId`),
  };
}

function toOfferingItem(value: unknown, field: string): DemoOfferingItem {
  const o = obj(value, field);
  return {
    title: str(o.title, `${field}.title`),
    body: str(o.body, `${field}.body`),
  };
}

function toPlaceholder(value: unknown, field: string): DemoPlaceholder {
  const p = obj(value, field);
  return { label: str(p.label, `${field}.label`) };
}

function toSection(value: unknown, field: string): DemoSection {
  const s = obj(value, field);
  const kind = str(s.kind, `${field}.kind`);
  const id = sectionId(s.id, `${field}.id`);

  switch (kind) {
    case "hero":
      return {
        kind: "hero",
        id,
        eyebrow: str(s.eyebrow, `${field}.eyebrow`),
        heading: str(s.heading, `${field}.heading`),
        subheading: str(s.subheading, `${field}.subheading`),
        primaryCta: toCta(s.primaryCta, `${field}.primaryCta`),
        secondaryCta:
          s.secondaryCta === null || s.secondaryCta === undefined
            ? null
            : toCta(s.secondaryCta, `${field}.secondaryCta`),
      };
    case "offering":
      return {
        kind: "offering",
        id,
        heading: str(s.heading, `${field}.heading`),
        intro: str(s.intro, `${field}.intro`),
        items: nonEmptyList(s.items, `${field}.items`, toOfferingItem),
      };
    case "positioning":
      return {
        kind: "positioning",
        id,
        heading: str(s.heading, `${field}.heading`),
        body: str(s.body, `${field}.body`),
        points: nonEmptyList(s.points, `${field}.points`, str),
      };
    case "gallery":
      return {
        kind: "gallery",
        id,
        heading: str(s.heading, `${field}.heading`),
        body: str(s.body, `${field}.body`),
        placeholders: nonEmptyList(s.placeholders, `${field}.placeholders`, toPlaceholder),
      };
    case "contact":
      return {
        kind: "contact",
        id,
        heading: str(s.heading, `${field}.heading`),
        body: str(s.body, `${field}.body`),
        hoursNote: str(s.hoursNote, `${field}.hoursNote`),
      };
    case "cta":
      return {
        kind: "cta",
        id,
        heading: str(s.heading, `${field}.heading`),
        body: str(s.body, `${field}.body`),
        cta: toCta(s.cta, `${field}.cta`),
      };
    default:
      // An unrecognized section is rejected rather than skipped. Silently
      // dropping it would render a page that quietly differs from what was
      // generated and reviewed.
      return fail(`${field}.kind`, "is not a known section kind");
  }
}

/** Validate the generated content subtree, including its internal references. */
export function toDemoSiteContent(value: unknown): DemoSiteContent {
  const c = obj(value, "spec.content");

  const theme = str(c.theme, "spec.content.theme");
  if (!(theme in DEMO_THEME_LABELS)) fail("spec.content.theme", "is not a known theme");

  const sections = nonEmptyList(c.sections, "spec.content.sections", toSection);
  const ids = new Set(sections.map((s) => s.id));
  if (ids.size !== sections.length) fail("spec.content.sections", "contains duplicate section ids");

  const navigation = list(c.navigation, "spec.content.navigation", toNavItem);

  // Anchors must resolve. A nav item or CTA pointing at a section that does not
  // exist would render as a dead link in something we show a prospect.
  navigation.forEach((item, i) => {
    if (!ids.has(item.targetSectionId)) {
      fail(`spec.content.navigation[${i}].targetSectionId`, "does not match any section id");
    }
  });
  for (const section of sections) {
    const ctas: DemoCta[] =
      section.kind === "hero"
        ? [section.primaryCta, ...(section.secondaryCta ? [section.secondaryCta] : [])]
        : section.kind === "cta"
          ? [section.cta]
          : [];
    for (const cta of ctas) {
      if (cta.targetSectionId !== undefined && !ids.has(cta.targetSectionId)) {
        fail(`spec.content.sections[${section.id}].cta.targetSectionId`, "does not match any section id");
      }
    }
  }

  const footer = obj(c.footer, "spec.content.footer");

  return {
    siteTitle: str(c.siteTitle, "spec.content.siteTitle"),
    tagline: str(c.tagline, "spec.content.tagline"),
    theme: theme as DemoTheme,
    navigation,
    sections,
    footer: { note: str(footer.note, "spec.content.footer.note") },
  };
}

/** Validate a whole spec: application-owned facts plus generated content. */
export function toDemoSiteSpec(value: unknown): DemoSiteSpec {
  const spec = obj(value, "spec");
  return {
    business: toBusiness(spec.business),
    content: toDemoSiteContent(spec.content),
  };
}

/** Database row -> DemoSite. Throws on anything malformed. */
export function rowToDemoSite(row: DemoSiteRow): DemoSite {
  if (row.status !== "generated") fail("status", "is not a valid DemoSiteStatus");

  return {
    id: str(row.id, "id"),
    leadId: str(row.lead_id, "lead_id"),
    analysisId: str(row.analysis_id, "analysis_id"),
    status: row.status as DemoSiteStatus,
    createdAt: str(row.created_at, "created_at"),
    updatedAt: str(row.updated_at, "updated_at"),
    generator: {
      name: str(row.generator_name, "generator_name"),
      model: str(row.generator_model, "generator_model"),
    },
    spec: toDemoSiteSpec(row.spec),
  };
}

/** Validate an assembled draft before it is ever persisted. */
export function assertValidDemoDraft(draft: DemoSiteDraft): DemoSiteDraft {
  return {
    generator: {
      name: str(draft.generator?.name, "generator_name"),
      model: str(draft.generator?.model, "generator_model"),
    },
    spec: toDemoSiteSpec(draft.spec),
  };
}

/** DemoSite -> database row, ready to insert. */
export function demoSiteToRow(demo: DemoSite): DemoSiteRow {
  return {
    id: demo.id,
    lead_id: demo.leadId,
    analysis_id: demo.analysisId,
    status: demo.status,
    created_at: demo.createdAt,
    updated_at: demo.updatedAt,
    generator_name: demo.generator.name,
    generator_model: demo.generator.model,
    // Identity and timestamps live in real columns, never duplicated inside the
    // JSON document.
    spec: { business: demo.spec.business, content: demo.spec.content },
  };
}
