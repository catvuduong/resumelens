// Built-in synonym map. Keys are canonical terms; values are alternative spellings or abbreviations
// (already in the normalised form produced by `normalise`, e.g. "node.js" becomes "nodejs").
// A canonical term is also a skill: skill terms count double when weighting job keywords.
export const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  javascript: ['js', 'ecmascript', 'es6'],
  typescript: ['ts'],
  nodejs: ['node'],
  nextjs: ['next'],
  react: ['reactjs'],
  vue: ['vuejs'],
  angular: ['angularjs'],
  python: ['py'],
  golang: [],
  cpp: [],
  csharp: ['dotnet'],
  kubernetes: ['k8s'],
  docker: [],
  postgresql: ['postgres', 'psql'],
  mongodb: ['mongo'],
  mysql: [],
  sql: [],
  redis: [],
  kafka: ['apachekafka'],
  aws: ['amazonwebservices'],
  gcp: ['googlecloud'],
  azure: [],
  terraform: [],
  infrastructureascode: ['iac'],
  continuousintegration: ['ci'],
  continuousdelivery: ['cd'],
  machinelearning: ['ml'],
  artificialintelligence: ['ai'],
  restapi: ['rest', 'restful'],
  graphql: [],
  git: [],
  linux: [],
  html: ['html5'],
  css: ['css3'],
  tailwindcss: ['tailwind'],
  sass: ['scss'],
  jest: [],
  playwright: [],
  agile: ['scrum'],
  visualisation: ['visualization'],
  optimisation: ['optimization'],
  observability: [],
};

const LOOKUP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
  LOOKUP.set(canonical, canonical);
  for (const alias of aliases) LOOKUP.set(alias, canonical);
}

/** Terms that are skills in their own right (the synonym map keys). */
export const SKILL_TERMS: ReadonlySet<string> = new Set(Object.keys(SYNONYMS));

/** Returns the canonical synonym for a token, or undefined when the token is not in the map. */
export function synonymOf(token: string): string | undefined {
  return LOOKUP.get(token);
}
