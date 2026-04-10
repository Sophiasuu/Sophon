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
type GenerateOptions = {
    entities: EntityRecord[];
    framework: Framework;
    output?: string;
    template?: string;
};
type TechnicalOptions = {
    entities: EntityRecord[];
    site: string;
    output?: string;
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

declare const DEFAULT_PATTERNS: string[];
declare function discover(options: DiscoverOptions): Promise<DiscoverResult>;

declare function generate(options: GenerateOptions): Promise<GenerateSummary>;

declare function technical(options: TechnicalOptions): Promise<void>;

declare function enrich(options: EnrichOptions): Promise<void>;

declare function nextjs(_options: GenerateOptions): string;

declare function astro(_options: GenerateOptions): string;

declare function nuxt(_options: GenerateOptions): string;

declare function sveltekit(_options: GenerateOptions): string;

declare function remix(_options: GenerateOptions): string;

export { DEFAULT_PATTERNS, type DiscoverMode, type DiscoverOptions, type DiscoverResult, type EnrichOptions, type EntityRecord, type Framework, type GenerateOptions, type GenerateSummary, type TechnicalOptions, astro, discover, enrich, generate, nextjs, nuxt, remix, sveltekit, technical };
