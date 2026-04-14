type DiscoverMode = "csv" | "seed";
type EntityRecord = {
    id: string;
    name: string;
    slug: string;
    source: DiscoverMode;
    seedKeyword?: string;
    metadata: {
        title?: string;
        description?: string;
        tags?: string[];
        attributes?: Record<string, string>;
    };
};
type DiscoverResult = {
    generatedAt: string;
    mode: DiscoverMode;
    entityCount: number;
    entities: EntityRecord[];
};
type Framework = "nextjs" | "astro" | "nuxt" | "sveltekit" | "remix";
type DiscoverOptions = {
    csv?: string;
    seed?: string;
    output?: string;
    titleTemplate?: string;
    patterns?: string[];
};
type ProposedEntityIntent = "commercial" | "comparison" | "segmented" | "informational";
type ProposedEntityAction = "keep" | "review";
type ProposedEntity = {
    id: string;
    name: string;
    slug: string;
    intent: ProposedEntityIntent;
    priority: number;
    confidence: number;
    reason: string;
    action: ProposedEntityAction;
};
type ProposeOptions = {
    seed: string;
    patterns?: string[];
    limit?: number;
};
type ProposeResult = {
    generatedBy: string;
    generatedAt: string;
    seed: string;
    totalProposed: number;
    groupedByIntent: Record<ProposedEntityIntent, number>;
    entities: ProposedEntity[];
};
type GenerateOptions = {
    entities: EntityRecord[];
    framework: Framework;
    output?: string;
    template?: string;
    force?: boolean;
    site?: string;
};
type TechnicalOptions = {
    entities: EntityRecord[];
    site: string;
    output?: string;
    force?: boolean;
};
type EnrichOptions = {
    entities: EntityRecord[];
    apiKey?: string;
    output?: string;
    concurrency?: number;
    force?: boolean;
};
type GenerateSummary = {
    total: number;
    generated: number;
    warnings: string[];
    todos: number;
};
type ScoreCheck = {
    label: string;
    points: number;
    maxPoints: number;
    passed: boolean;
};
type EntityScore = {
    slug: string;
    name: string;
    score: number;
    grade: string;
    checks: ScoreCheck[];
};
type ScoreResult = {
    entityCount: number;
    averageScore: number;
    averageGrade: string;
    entities: EntityScore[];
};
type AuditCheck = {
    label: string;
    implemented: boolean;
    weight: number;
    details?: string;
};
type AuditResult = {
    score: number;
    maxScore: number;
    grade: string;
    checks: AuditCheck[];
};
type GSCCredentials = {
    type: "service_account" | "oauth";
    keyFilePath?: string;
    accessToken?: string;
};
type GSCQueryRow = {
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
};
type GSCPageMetrics = {
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    topQueries: GSCQueryRow[];
};
type GSCFetchOptions = {
    site: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    accessToken?: string;
    dimensions?: string[];
};
type GSCResponse = {
    rows: GSCQueryRow[];
    responseAggregationType?: string;
};
type OptimizationIssueType = "low_ctr" | "low_impressions" | "poor_position" | "striking_distance" | "high_impressions_low_clicks" | "intent_mismatch" | "weak_linking";
type RecommendationType = "meta" | "content" | "structure" | "linking";
type OptimizationRecommendation = {
    type: RecommendationType;
    action: string;
    reasoning: string;
};
type OptimizationPriority = "critical" | "high" | "medium" | "low";
type EntityOptimizationResult = {
    entity: string;
    slug: string;
    metrics: {
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
    };
    optimizationScore: number;
    issues: string[];
    issueTypes: OptimizationIssueType[];
    recommendations: OptimizationRecommendation[];
    priority: OptimizationPriority;
};
type OptimizationReport = {
    generatedAt: string;
    site: string;
    totalEntities: number;
    analyzedEntities: number;
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        averageScore: number;
    };
    entities: EntityOptimizationResult[];
};
type OptimizeOptions = {
    site: string;
    entities: EntityRecord[];
    limit?: number;
    autoFix?: boolean;
    output?: string;
    accessToken?: string;
    gscData?: GSCPageMetrics[];
};
type BlogOptions$1 = {
    entities: EntityRecord[];
    output?: string;
    postsPerEntity?: number;
};
type QualityOptions = {
    entities: EntityRecord[];
    contentDir?: string;
    output?: string;
};
type KeywordOptions = {
    entities: EntityRecord[];
    output?: string;
};
type EnrichedSection = {
    heading: string;
    body: string;
};
type EnrichedFaq = {
    question: string;
    answer: string;
};
type EnrichedComparison = {
    entity: string;
    difference: string;
};
type EnrichedContent = {
    slug: string;
    seo: {
        title: string;
        metaDescription: string;
        canonicalPath: string;
    };
    content: {
        intro: string;
        sections: EnrichedSection[];
        faqs: EnrichedFaq[];
        comparisons: EnrichedComparison[];
    };
    schema: {
        type: string;
        name: string;
        description: string;
    };
    warnings: string[];
};

declare const DEFAULT_PATTERNS: string[];
declare function discover(options: DiscoverOptions): Promise<DiscoverResult>;

declare function propose(options: ProposeOptions): ProposeResult;

declare function renderYmylDisclaimer(framework: Framework, entity: EntityRecord): string;
declare function loadEnrichedContent(slug: string, enrichDir?: string): Promise<EnrichedContent | null>;
declare function generate(options: GenerateOptions): Promise<GenerateSummary>;

type FaqSchemaRecord = {
    "@context": "https://schema.org";
    "@type": "FAQPage";
    mainEntity: Array<{
        "@type": "Question";
        name: string;
        acceptedAnswer: {
            "@type": "Answer";
            text: string;
        };
    }>;
};
declare function buildFaqSchema(entity: EntityRecord, enrichedFaqs?: EnrichedFaq[]): FaqSchemaRecord | null;
declare function technical(options: TechnicalOptions): Promise<void>;

declare function enrich(options: EnrichOptions): Promise<void>;

declare function teach(): Promise<void>;

type AuditOptions = {
    root?: string;
};
declare function audit(options?: AuditOptions): Promise<AuditResult>;

type IntentClassification = {
    intent: ProposedEntityIntent;
    priority: number;
    confidence: number;
    reason: string;
    action: ProposedEntityAction;
};
declare function classifyIntent(name: string): IntentClassification;

type SectionDefinition = {
    heading: string;
    placeholder: string;
};
declare function getSections(intent: ProposedEntityIntent): SectionDefinition[];
declare function renderSections(framework: Framework, sections: SectionDefinition[]): string;

declare function scoreEntities(entities: EntityRecord[]): ScoreResult;

declare function fetchGSCData(options: GSCFetchOptions): Promise<GSCPageMetrics[]>;
/**
 * Build GSCPageMetrics from pre-loaded data (for testing or offline use).
 */
declare function buildMetricsFromRows(rows: GSCQueryRow[]): GSCPageMetrics[];

type MappedEntity = {
    entity: EntityRecord;
    metrics: GSCPageMetrics | undefined;
};
/**
 * Map GSC page metrics to Sophon entities by matching URL slugs.
 *
 * Matching strategy (in order):
 * 1. Exact slug match in URL path
 * 2. URL path ends with entity slug
 * 3. Slug appears anywhere in URL path
 */
declare function mapEntitiesToGSC(entities: EntityRecord[], gscPages: GSCPageMetrics[], siteUrl: string): MappedEntity[];
/**
 * Returns only entities that have matching GSC data (mapped entities).
 */
declare function filterMappedEntities(mapped: MappedEntity[]): MappedEntity[];
/**
 * Returns entities that have no GSC data (unmapped / not indexed).
 */
declare function filterUnmappedEntities(mapped: MappedEntity[]): MappedEntity[];

declare function analyzeEntity(mapped: MappedEntity): EntityOptimizationResult | undefined;
declare function analyzeAll(mappedEntities: MappedEntity[]): EntityOptimizationResult[];
declare function calculateScore(metrics: GSCPageMetrics, issueTypes: OptimizationIssueType[]): number;

declare function generateRecommendations(issueTypes: OptimizationIssueType[], metrics: GSCPageMetrics, entity: EntityRecord): OptimizationRecommendation[];

type AutoFixResult = {
    slug: string;
    applied: string[];
    skipped: string[];
};
declare function applyAutoFixes(results: EntityOptimizationResult[], entities: EntityRecord[], outputRoot: string): Promise<AutoFixResult[]>;
/**
 * Check if a file is Sophon-generated (safe to modify).
 */
declare function isSophonFile(filePath: string): Promise<boolean>;

declare function optimize(options: OptimizeOptions): Promise<OptimizationReport>;

/**
 * Content humanization — post-process AI-generated text to remove
 * mechanical patterns, AI-isms, and formatting artifacts.
 */
declare function humanize(text: string): string;
/**
 * Humanize all string fields in a JSON content object recursively.
 */
declare function humanizeContent(obj: unknown): unknown;
/**
 * Count AI-ism occurrences for quality scoring purposes.
 */
declare function countAiPatterns(text: string): number;

/**
 * Content quality scoring — evaluate generated/enriched content
 * for word count, readability, heading structure, and uniqueness signals.
 */

type QualityCheck = {
    label: string;
    score: number;
    maxScore: number;
    passed: boolean;
    detail?: string;
};
type ContentQualityResult = {
    slug: string;
    name: string;
    overallScore: number;
    grade: string;
    checks: QualityCheck[];
};
type QualityReport = {
    generatedAt: string;
    entityCount: number;
    averageScore: number;
    averageGrade: string;
    entities: ContentQualityResult[];
};
declare function fleschKincaid(text: string): number;
declare function trigramOverlap(textA: string, textB: string): number;
declare function scoreContent(entity: EntityRecord, content: string): ContentQualityResult;
declare function scoreAllContent(entities: EntityRecord[], contentMap: Map<string, string>): QualityReport;

/**
 * Keyword data integration — basic keyword scoring and volume estimation.
 * Uses heuristic signals (word count, modifier presence, competition indicators)
 * since we don't depend on paid keyword APIs.
 */

type KeywordDifficulty = "easy" | "medium" | "hard";
type KeywordData = {
    keyword: string;
    slug: string;
    estimatedMonthlyVolume: number;
    difficulty: KeywordDifficulty;
    intent: ProposedEntityIntent;
    cpcEstimate: string;
    opportunityScore: number;
};
declare function analyzeKeyword(entity: EntityRecord): KeywordData;
declare function analyzeKeywords(entities: EntityRecord[]): KeywordData[];

/**
 * Blog / supporting content generation — creates supporting article
 * outlines for entity pages to build topical authority and internal linking.
 */

type BlogOutline = {
    slug: string;
    parentEntity: string;
    title: string;
    intent: ProposedEntityIntent;
    sections: string[];
    internalLinks: string[];
    targetKeywords: string[];
};
type BlogOptions = {
    entities: EntityRecord[];
    output?: string;
    postsPerEntity?: number;
};
declare function generateBlogOutlines(entities: EntityRecord[], postsPerEntity?: number): BlogOutline[];
declare function blog(options: BlogOptions): Promise<BlogOutline[]>;

declare function nextjs(_options: GenerateOptions): string;

declare function astro(_options: GenerateOptions): string;

declare function nuxt(_options: GenerateOptions): string;

declare function sveltekit(_options: GenerateOptions): string;

declare function remix(_options: GenerateOptions): string;

declare function slugify(value: string): string;
declare function stableHash(value: string): string;
/**
 * JSON.stringify that also escapes < and > as Unicode escapes.
 * Prevents </script> injection when JSON values appear inside HTML <script> tags
 * (e.g. Nuxt .vue and SvelteKit .svelte files).
 */
declare function safeJsonStringify(value: unknown): string;
declare function gradeFromScore(score: number): string;
declare function assertSafePath(filePath: string): void;

export { type AuditCheck, type AuditResult, type BlogOptions$1 as BlogOptions, DEFAULT_PATTERNS, type DiscoverMode, type DiscoverOptions, type DiscoverResult, type EnrichOptions, type EnrichedComparison, type EnrichedContent, type EnrichedFaq, type EnrichedSection, type EntityOptimizationResult, type EntityRecord, type EntityScore, type Framework, type GSCCredentials, type GSCFetchOptions, type GSCPageMetrics, type GSCQueryRow, type GSCResponse, type GenerateOptions, type GenerateSummary, type KeywordOptions, type OptimizationIssueType, type OptimizationPriority, type OptimizationRecommendation, type OptimizationReport, type OptimizeOptions, type ProposeOptions, type ProposeResult, type ProposedEntity, type ProposedEntityAction, type ProposedEntityIntent, type QualityOptions, type RecommendationType, type ScoreCheck, type ScoreResult, type TechnicalOptions, analyzeAll, analyzeEntity, analyzeKeyword, analyzeKeywords, applyAutoFixes, assertSafePath, astro, audit, blog, buildFaqSchema, buildMetricsFromRows, calculateScore, classifyIntent, countAiPatterns, discover, enrich, fetchGSCData, filterMappedEntities, filterUnmappedEntities, fleschKincaid, generate, generateBlogOutlines, generateRecommendations, getSections, gradeFromScore, humanize, humanizeContent, isSophonFile, loadEnrichedContent, mapEntitiesToGSC, nextjs, nuxt, optimize, propose, remix, renderSections, renderYmylDisclaimer, safeJsonStringify, scoreAllContent, scoreContent, scoreEntities, slugify, stableHash, sveltekit, teach, technical, trigramOverlap };
