import { analyseMatch, extractBullets, extractJobTerms, MAX_JOB_TERMS } from './analyse.js';

describe('analyseMatch', () => {
  it('scores identical texts as 100 with nothing missing', () => {
    const text = 'Frontend engineer with React, TypeScript, testing and Docker experience.';
    const result = analyseMatch(text, text);
    expect(result.score).toBe(100);
    expect(result.missing).toEqual([]);
    expect(result.matched.map((k) => k.term)).toEqual(expect.arrayContaining(['react', 'typescript', 'docker']));
  });

  it('scores zero when there is no overlap, and lists every job keyword as missing', () => {
    const result = analyseMatch('Gardening, cooking and painting.', 'Kubernetes, Docker and PostgreSQL required.');
    expect(result.score).toBe(0);
    expect(result.matched).toEqual([]);
    expect(result.missing.map((k) => k.term)).toEqual(expect.arrayContaining(['kubernetes', 'docker', 'postgresql']));
  });

  it('scores zero and explains itself when the job text has no usable keywords', () => {
    const result = analyseMatch('Built things.', 'The and of with the. We are looking for you.');
    expect(result.score).toBe(0);
    expect(result.matched).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.tips[0]).toContain('no recognisable keywords');
  });

  it('weights a job keyword by how often it appears in the job text', () => {
    // "communication" appears three times in the job text, "stakeholders" once: 3 / (3 + 1) = 75%.
    const result = analyseMatch(
      'Strong communication skills.',
      'communication communication communication stakeholders',
    );
    expect(result.score).toBe(75);
    expect(result.missing).toEqual([{ term: 'stakeholders', weight: 1 }]);
  });

  it('does not inflate the score when the CV repeats a keyword', () => {
    const once = analyseMatch('communication', 'communication stakeholders');
    const many = analyseMatch('communication communication communication', 'communication stakeholders');
    expect(many.score).toBe(once.score);
    expect(many.score).toBe(50);
  });

  it('ranks missing keywords by weight, highest first', () => {
    const result = analyseMatch('nothing relevant here', 'Kafka. Kafka. Terraform. Terraform. Terraform. Golang.');
    expect(result.missing.map((k) => k.term)).toEqual(['terraform', 'kafka', 'golang']);
    expect(result.missing.map((k) => k.weight)).toEqual([6, 4, 2]);
  });

  it('matches synonyms in both directions', () => {
    const result = analyseMatch(
      'Worked on k8s clusters and wrote js tooling.',
      'Kubernetes and JavaScript',
    );
    expect(result.score).toBe(100);
    expect(result.matched.map((k) => k.term)).toEqual(expect.arrayContaining(['kubernetes', 'javascript']));
  });

  it('matches plural and singular forms', () => {
    const result = analyseMatch('Built data pipeline jobs.', 'Experience with data pipelines.');
    expect(result.score).toBe(100);
  });

  it('caps the number of scored job terms', () => {
    const job = Array.from({ length: 60 }, (_, i) => `alpha${i}`).join(' ');
    const result = analyseMatch('', job);
    expect(result.missing).toHaveLength(MAX_JOB_TERMS);
    expect(result.score).toBe(0);
  });

  it('is deterministic for the same input', () => {
    const cv = '- Built APIs in Node.js\n- Reduced costs by 20%';
    const job = 'Node.js, PostgreSQL, Docker';
    expect(analyseMatch(cv, job)).toEqual(analyseMatch(cv, job));
  });

  it('keeps job terms with skill weighting for skill-like words', () => {
    const terms = extractJobTerms('docker communication');
    const docker = terms.find((t) => t.key === 'docker');
    const communication = terms.find((t) => t.key === 'communication');
    expect(docker?.weight).toBe(2);
    expect(communication?.weight).toBe(1);
  });
});

describe('extractBullets', () => {
  it('uses marked lines and ignores headings', () => {
    const cv = 'Experience\n- Led migration of three services\n- Helped with tasks';
    expect(extractBullets(cv)).toEqual(['Led migration of three services', 'Helped with tasks']);
  });

  it('falls back to lines with at least four words when nothing is marked', () => {
    const cv = 'Experience\nBuilt a reporting pipeline for finance\nCoffee';
    expect(extractBullets(cv)).toEqual(['Built a reporting pipeline for finance']);
  });

  it('handles Windows line endings and numbered lists', () => {
    const cv = '1. Shipped the checkout redesign\r\n2) Wrote the release runbook';
    expect(extractBullets(cv)).toEqual(['Shipped the checkout redesign', 'Wrote the release runbook']);
  });

  it('returns nothing for an empty CV', () => {
    expect(extractBullets('   \n  ')).toEqual([]);
  });
});

describe('tips', () => {
  it('asks for measurable results in a bullet that has none', () => {
    const result = analyseMatch(
      '- Led the migration of the billing services\n- Cut checkout latency by 20% across regions',
      'billing services',
    );
    expect(result.tips).toContain(
      'Add measurable results to bullet 1: a number, percentage, volume or time saved.',
    );
    expect(result.tips.some((tip) => tip.includes('bullet 2'))).toBe(false);
  });

  it('suggests a stronger opening verb for weak starts', () => {
    const result = analyseMatch('- Responsible for the team deployments and on-call rota', 'deployments');
    expect(result.tips).toContain('Start bullet 1 with a strong action verb instead of "Responsible for".');
  });

  it('suggests shortening very long bullets', () => {
    const long = Array.from({ length: 35 }, (_, i) => `word${i}`).join(' ');
    const result = analyseMatch(`- ${long}`, 'anything');
    expect(result.tips.some((tip) => tip.startsWith('Shorten bullet 1'))).toBe(true);
  });

  it('names a missing keyword in a tip', () => {
    const result = analyseMatch('nothing', 'Kafka streaming');
    expect(result.tips).toContain('Mention "kafka" in a bullet if you have real experience with it.');
  });

  it('describes coverage in plain language by score band', () => {
    expect(analyseMatch('Kafka', 'Kafka').tips[0]).toContain('Strong keyword coverage');
    expect(analyseMatch('nothing', 'Kafka').tips[0]).toContain('Low coverage');
  });

  it('asks for bullets when the CV has none', () => {
    const result = analyseMatch('Kafka', 'Kafka');
    expect(result.tips.some((tip) => tip.includes("starting with '-'"))).toBe(true);
  });
});
