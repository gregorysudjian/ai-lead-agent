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
  DemoLayout,
  DemoTheme,
} from "@/lib/demo-site";
import { validateDemoDesign } from "@/lib/demo-design/genome";
import type { DemoDesign } from "@/lib/demo-design/types";
import { contentStructure, DEMO_LAYOUT_LABELS, DEMO_THEME_LABELS } from "@/lib/demo-site";
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

/**
 * Read a section's `sample` flag, tolerating records written before it existed.
 *
 * The flag was added after demos had already been stored. Those rows have no
 * `sample` key, and rejecting them would make every previously generated demo
 * unreadable -- which is exactly what happened when this was a plain `bool`.
 *
 * Missing means TRUE, not false. A demo written before we tracked provenance
 * has content of UNKNOWN provenance, and the honest reading of unknown is "we
 * cannot vouch for this". Defaulting to false would silently promote old
 * placeholder copy to "confirmed", which is the one outcome the whole flag
 * exists to prevent.
 *
 * A present-but-wrong-typed value is still a hard failure: that is corruption,
 * not age.
 */
function sampleFlag(value: unknown, field: string): boolean {
  if (value === undefined || value === null) return true;
  return bool(value, field);
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

    // Profile-sourced facts, absent from any demo stored before research fed
    // this layer. Missing reads as "we had none", which is exactly right: an
    // older demo genuinely was built without them, and back-filling it would
    // claim it showed something it never did.
    socialLinks: optionalStrings(b.socialLinks, "spec.business.socialLinks"),
    openingHours: optionalStrings(b.openingHours, "spec.business.openingHours"),
    bookingUrl: strOrNull(b.bookingUrl ?? null, "spec.business.bookingUrl"),
    ownDescription: strOrNull(b.ownDescription ?? null, "spec.business.ownDescription"),
    profileSourced: b.profileSourced === undefined ? false : bool(b.profileSourced, "spec.business.profileSourced"),
  };
}

/** A list of strings that an older stored spec may simply not have. */
function optionalStrings(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  return list(value, field, str);
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
        sample: sampleFlag(s.sample, `${field}.sample`),
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
        sample: sampleFlag(s.sample, `${field}.sample`),
        heading: str(s.heading, `${field}.heading`),
        intro: str(s.intro, `${field}.intro`),
        items: nonEmptyList(s.items, `${field}.items`, toOfferingItem),
      };
    case "positioning":
      return {
        kind: "positioning",
        id,
        sample: sampleFlag(s.sample, `${field}.sample`),
        heading: str(s.heading, `${field}.heading`),
        body: str(s.body, `${field}.body`),
        points: nonEmptyList(s.points, `${field}.points`, str),
      };
    case "gallery":
      return {
        kind: "gallery",
        id,
        sample: sampleFlag(s.sample, `${field}.sample`),
        heading: str(s.heading, `${field}.heading`),
        body: str(s.body, `${field}.body`),
        placeholders: nonEmptyList(s.placeholders, `${field}.placeholders`, toPlaceholder),
      };
    case "contact":
      return {
        kind: "contact",
        id,
        sample: sampleFlag(s.sample, `${field}.sample`),
        heading: str(s.heading, `${field}.heading`),
        body: str(s.body, `${field}.body`),
        hoursNote: str(s.hoursNote, `${field}.hoursNote`),
      };
    case "cta":
      return {
        kind: "cta",
        id,
        sample: sampleFlag(s.sample, `${field}.sample`),
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

  // Tolerated when absent, like `sample`: the field was added after demos had
  // already been stored, and rejecting those rows would make every previously
  // generated demo unreadable. "classic" is the design those pages were
  // actually rendered with, so an old demo keeps looking exactly as it did.
  // A present-but-unknown value is still a hard failure -- that is corruption.
  const layout = c.layout === undefined || c.layout === null
    ? "classic"
    : str(c.layout, "spec.content.layout");
  if (!(layout in DEMO_LAYOUT_LABELS)) fail("spec.content.layout", "is not a known layout");

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
    layout: layout as DemoLayout,
    navigation,
    sections,
    footer: { note: str(footer.note, "spec.content.footer.note") },
  };
}

/**
 * The design, when the spec has one.
 *
 * Absent is legitimate and common -- every demo stored before designs existed
 * -- and means "render with the original renderer". Present but invalid is
 * corruption and fails like any other malformed field: a design is closed
 * sets and hex colours, and nothing else may reach a style attribute.
 */
function toDesign(value: unknown): DemoDesign | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return validateDemoDesign(value);
  } catch (error) {
    return fail("spec.design", error instanceof Error ? `is invalid (${error.message})` : "is invalid");
  }
}

/**
 * The other-language versions, when the spec has them.
 *
 * Each must be the SAME page as `content` in other words. A French version
 * with an extra section, a different service count, a button that calls where
 * the English one scrolls, or a section marked sample in one language and
 * confirmed in the other would be two different proposals behind one link.
 */
function toAlternates(value: unknown, content: DemoSiteContent): DemoSiteSpec["alternates"] {
  if (value === undefined || value === null) return undefined;
  const alternates = obj(value, "spec.alternates");
  for (const key of Object.keys(alternates)) {
    if (key !== "fr") fail(`spec.alternates.${key}`, "is not a supported language");
  }
  if (alternates.fr === undefined) return {};
  const fr = toDemoSiteContent(alternates.fr);
  if (contentStructure(fr) !== contentStructure(content)) {
    fail("spec.alternates.fr", "does not have the same structure as spec.content");
  }
  return { fr };
}

/** Validate a whole spec: application-owned facts plus generated content. */
export function toDemoSiteSpec(value: unknown): DemoSiteSpec {
  const spec = obj(value, "spec");
  const content = toDemoSiteContent(spec.content);
  const design = toDesign(spec.design);
  const alternates = toAlternates(spec.alternates, content);
  // Optional keys are omitted rather than set to undefined, so a spec stored
  // before they existed reads back exactly as it was written.
  return {
    business: toBusiness(spec.business),
    content,
    ...(design ? { design } : {}),
    ...(alternates ? { alternates } : {}),
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
    spec: {
      business: demo.spec.business,
      content: demo.spec.content,
      ...(demo.spec.design ? { design: demo.spec.design } : {}),
      ...(demo.spec.alternates ? { alternates: demo.spec.alternates } : {}),
    },
  };
}
