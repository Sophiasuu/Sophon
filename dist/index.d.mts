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

declare const DEFAULT_PATTERNS: string[];
declare function discover(options: DiscoverOptions): Promise<DiscoverResult>;

declare function propose(options: ProposeOptions): ProposeResult;

declare function generate(options: GenerateOptions): Promise<GenerateSummary>;

declare function technical(options: TechnicalOptions): Promise<void>;

declare function enrich(options: EnrichOptions): Promise<void>;

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

declare function nextjs(_options: GenerateOptions): string;

declare function astro(_options: GenerateOptions): string;

declare function nuxt(_options: GenerateOptions): string;

declare function sveltekit(_options: GenerateOptions): string;

declare function remix(_options: GenerateOptions): string;

export { type AuditCheck, type AuditResult, DEFAULT_PATTERNS, type DiscoverMode, type DiscoverOptions, type DiscoverResult, type EnrichOptions, type EntityRecord, type EntityScore, type Framework, type GenerateOptions, type GenerateSummary, type ProposeOptions, type ProposeResult, type ProposedEntity, type ProposedEntityAction, type ProposedEntityIntent, type ScoreCheck, type ScoreResult, type TechnicalOptions, astro, audit, classifyIntent, discover, enrich, generate, getSections, nextjs, nuxt, propose, remix, renderSections, scoreEntities, sveltekit, technical };
