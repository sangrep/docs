import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const releasedSidebar = [
  { label: 'Overview', link: '/' },
  { label: 'Start', items: [{ autogenerate: { directory: 'start' } }] },
  { label: 'Releases', items: [{ autogenerate: { directory: 'releases' } }] },
];

const reviewSidebar = [
  ...releasedSidebar.slice(0, 2),
  {
    label: 'Workspaces',
    items: [{ autogenerate: { directory: 'workspaces' } }],
  },
  {
    label: 'Configuration',
    items: [{ autogenerate: { directory: 'configuration' } }],
  },
  { label: 'Privacy', items: [{ autogenerate: { directory: 'privacy' } }] },
  { label: 'Recovery', items: [{ autogenerate: { directory: 'recovery' } }] },
  {
    label: 'Troubleshooting',
    items: [{ autogenerate: { directory: 'troubleshooting' } }],
  },
  releasedSidebar[2],
];

export default defineConfig({
  output: 'static',
  site: 'https://docs.sangrep.com',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'Sangrep Workbench',
      description:
        'Task-focused product documentation with explicit release and privacy boundaries.',
      favicon: '/favicon.svg',
      customCss: ['./src/styles/custom.css'],
      components: {
        MobileMenuToggle: './src/components/MobileMenuToggle.astro',
        PageTitle: './src/components/PageTitle.astro',
      },
      credits: false,
      lastUpdated: false,
      pagination: true,
      sidebar: process.env.DOCS_REVIEW === 'true' ? reviewSidebar : releasedSidebar,
      social: [
        {
          icon: 'github',
          label: 'Sangrep documentation on GitHub',
          href: 'https://github.com/sangrep/docs',
        },
      ],
      titleDelimiter: '·',
    }),
  ],
});
