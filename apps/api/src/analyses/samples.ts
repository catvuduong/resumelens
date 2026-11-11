// Fictional example data only. Used to seed the history page and mirrored in the web app's "Load sample" button.
export interface SamplePair {
  label: string;
  cvText: string;
  jobText: string;
}

export const SAMPLE_PAIRS: readonly SamplePair[] = [
  {
    label: 'Frontend engineer',
    cvText: [
      'Sample candidate, frontend developer',
      '',
      'Experience',
      '- Built a customer dashboard in React and TypeScript used by 4,000 monthly users.',
      '- Reduced page load time by 35% by splitting bundles and caching API responses.',
      '- Wrote unit tests with Jest and Testing Library, raising coverage from 45% to 80%.',
      '- Responsible for maintaining the internal design system used by three teams.',
      '- Helped migrate a legacy jQuery admin panel to Next.js with server-side rendering.',
      '- Worked with designers and product managers to ship features every two weeks.',
      '',
      'Skills: JavaScript, HTML, CSS, Git, REST APIs, Docker',
    ].join('\n'),
    jobText: [
      'Senior Frontend Engineer (sample role)',
      'We are looking for a frontend engineer to build fast, accessible web applications.',
      'Requirements:',
      '- 4+ years of experience with JavaScript and TypeScript',
      '- Strong React and Next.js skills, including server-side rendering',
      '- Experience with GraphQL or REST APIs',
      '- Testing with Jest or Playwright; you care about test coverage',
      '- Familiarity with Docker and Kubernetes deployments',
      '- Performance tuning, accessibility (WCAG) and design systems',
      '- Excellent communication and a collaborative team mindset',
      'Nice to have: AWS, CI/CD pipelines, Node.js.',
    ].join('\n'),
  },
  {
    label: 'Data analyst',
    cvText: [
      'Sample candidate, junior data analyst',
      '',
      'Experience',
      '- Built weekly sales reports in SQL and Excel that saved the team 6 hours a week.',
      '- Created Power BI dashboards for regional managers covering 12 metrics.',
      '- Cleaned and joined three data sources with Python (pandas) for churn analysis.',
      '- Presented findings to stakeholders during quarterly reviews.',
    ].join('\n'),
    jobText: [
      'Data Analyst (sample role)',
      'Turn raw data into clear insights for product and finance teams.',
      'Requirements:',
      '- Strong SQL and experience with PostgreSQL or similar databases',
      '- Python for data analysis (pandas, numpy)',
      '- Dashboards with Tableau or Power BI',
      '- Experience with A/B testing and statistics',
      '- Communication skills and attention to data quality',
      'Nice to have: dbt, Airflow, cloud data warehouses (AWS or GCP).',
    ].join('\n'),
  },
  {
    label: 'Backend engineer',
    cvText: [
      'Sample candidate, backend developer',
      '',
      'Experience',
      '- Designed a Node.js REST API that handles 2 million requests per day.',
      '- Migrated the order service from MongoDB to PostgreSQL with zero downtime.',
      '- Set up CI pipelines in GitHub Actions, cutting release time from 2 hours to 20 minutes.',
      '- Helped the team with code reviews and onboarding of two new engineers.',
    ].join('\n'),
    jobText: [
      'Backend Engineer (sample role)',
      'Own services that power our marketplace.',
      'Requirements:',
      '- Node.js or Go in production, building REST or gRPC APIs',
      '- PostgreSQL schema design and query tuning',
      '- Docker and Kubernetes for deployment',
      '- CI/CD pipelines and automated testing',
      '- Monitoring and observability with metrics and logs',
      '- Strong ownership and communication',
      'Nice to have: Kafka, Terraform, AWS.',
    ].join('\n'),
  },
];
