/**
 * The structured-output schema for a generated demo site.
 *
 * ONE definition: this Zod schema is what the model is constrained to, and its
 * inferred type is checked against `DemoSiteGeneratorResult` at compile time.
 * If the domain type gains a field and this does not, the assignment at the
 * bottom stops compiling, so the two cannot silently drift.
 *
 * Note what is absent, because absence is the safety mechanism. There is no
 * field for a business name, a phone number, an address, an opening time, a
 * price, a testimonial, or a URL of any kind. A model that wanted to invent a
 * booking link or a five-star review has nowhere to put it -- the constraint is
 * structural, not a matter of the prompt being persuasive enough.
 */
import { z } from "zod";

import type { DemoSiteGeneratorResult, DemoTheme } from "@/lib/demo-site";
import { DEMO_THEME_LABELS } from "@/lib/demo-site";

const THEMES = Object.keys(DEMO_THEME_LABELS) as [DemoTheme, ...DemoTheme[]];

/**
 * Section ids double as HTML anchor fragments.
 *
 * The same conservative slug the repository enforces on the way in, applied
 * here on the way out, so a malformed id is rejected before it is ever stored.
 */
const sectionId = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,39}$/, "must be a lowercase slug of letters, digits and hyphens");

const ctaSchema = z.object({
  label: z.string().min(1).max(60),
  // An ENUM, not a URL. The renderer resolves `call` against the
  // application-owned phone number and the others against in-page anchors.
  action: z.enum(["call", "directions", "scroll"]),
  targetSectionId: sectionId.optional(),
});

const line = (max: number) => z.string().min(1).max(max);

/**
 * `sample` marks a section whose copy is category-typical placeholder content
 * rather than something evidenced about this business. A generator must
 * declare it, but the declaration is not trusted: `enforceSampleFlags` OR-s in
 * what the held facts require, so the flag can only ever become MORE true.
 */
const heroSection = z.object({
  kind: z.literal("hero"),
  id: sectionId,
  sample: z.boolean(),
  eyebrow: line(80),
  heading: line(120),
  subheading: line(300),
  primaryCta: ctaSchema,
  secondaryCta: ctaSchema.nullable(),
});

const offeringSection = z.object({
  kind: z.literal("offering"),
  id: sectionId,
  sample: z.boolean(),
  heading: line(120),
  intro: line(400),
  items: z
    .array(z.object({ title: line(80), body: line(400) }))
    .min(2)
    .max(6),
});

const positioningSection = z.object({
  kind: z.literal("positioning"),
  id: sectionId,
  sample: z.boolean(),
  heading: line(120),
  body: line(700),
  points: z.array(line(200)).min(2).max(5),
});

const gallerySection = z.object({
  kind: z.literal("gallery"),
  id: sectionId,
  sample: z.boolean(),
  heading: line(120),
  body: line(400),
  // A placeholder says plainly what a real photograph would go here. We do not
  // fetch stock imagery and do not invent photographs of a shop we never saw.
  placeholders: z.array(z.object({ label: line(80) })).min(2).max(6),
});

const contactSection = z.object({
  kind: z.literal("contact"),
  id: sectionId,
  sample: z.boolean(),
  heading: line(120),
  body: line(400),
  /** Prose about hours. Never a schedule -- the model is not given the hours. */
  hoursNote: line(200),
});

const ctaSection = z.object({
  kind: z.literal("cta"),
  id: sectionId,
  sample: z.boolean(),
  heading: line(120),
  body: line(400),
  cta: ctaSchema,
});

export const demoContentSchema = z.object({
  siteTitle: line(120),
  tagline: line(200),
  theme: z.enum(THEMES),
  navigation: z
    .array(z.object({ label: line(40), targetSectionId: sectionId }))
    .min(2)
    .max(6),
  sections: z
    .array(
      z.discriminatedUnion("kind", [
        heroSection,
        offeringSection,
        positioningSection,
        gallerySection,
        contactSection,
        ctaSection,
      ]),
    )
    .min(3)
    .max(7),
  footer: z.object({ note: line(300) }),
});

/**
 * Compile-time proof that the schema matches the domain contract.
 *
 * If these ever diverge, this file fails to typecheck.
 */
export type SchemaResult = z.infer<typeof demoContentSchema>;
const _schemaMatchesDomain: DemoSiteGeneratorResult = null as unknown as SchemaResult;
const _domainMatchesSchema: SchemaResult = null as unknown as DemoSiteGeneratorResult;
void _schemaMatchesDomain;
void _domainMatchesSchema;
