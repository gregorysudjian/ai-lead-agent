/**
 * The structured-output schema, derived from the domain contract.
 *
 * ONE definition: this Zod schema is what the model is constrained to, and its
 * inferred type is checked against `AnalysisProviderResult` at compile time. If
 * the domain type gains a field and this does not, the assignment below stops
 * compiling -- so the two cannot silently drift apart.
 *
 * Note what is absent: no facts, no ids, no timestamps. The model is not given
 * anywhere to put them.
 */
import { z } from "zod";

import type { AnalysisProviderResult, RecommendedSiteType } from "@/lib/analysis";
import { RECOMMENDED_SITE_TYPE_LABELS } from "@/lib/analysis";

const SITE_TYPES = Object.keys(RECOMMENDED_SITE_TYPE_LABELS) as [
  RecommendedSiteType,
  ...RecommendedSiteType[],
];

/** Bounded lists: caps keep output focused and cost predictable. */
const shortList = (min: number, max: number) => z.array(z.string().min(1).max(300)).min(min).max(max);

export const analysisResultSchema = z.object({
  recommendations: z.object({
    businessSummary: z.string().min(1).max(600),
    websiteOpportunity: z.string().min(1).max(900),
    recommendedSiteType: z.enum(SITE_TYPES),
    recommendedPages: shortList(2, 8),
    homepageSections: shortList(3, 8),
    keySellingPoints: shortList(2, 6),
    callsToAction: shortList(1, 5),
    designDirection: z.object({
      tone: z.string().min(1).max(300),
      palette: z.string().min(1).max(300),
      imagery: z.string().min(1).max(300),
      typography: z.string().min(1).max(300),
    }),
    draftPositioning: z.string().min(1).max(300),
  }),
  assumptions: shortList(1, 6),
  limitations: shortList(2, 8),
});

/**
 * Compile-time proof that the schema matches the domain contract.
 *
 * If these ever diverge, this line fails to typecheck.
 */
export type SchemaResult = z.infer<typeof analysisResultSchema>;
const _schemaMatchesDomain: AnalysisProviderResult = null as unknown as SchemaResult;
const _domainMatchesSchema: SchemaResult = null as unknown as AnalysisProviderResult;
void _schemaMatchesDomain;
void _domainMatchesSchema;
