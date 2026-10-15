/** Single source of truth for site navigation, shared by Header and Footer. */

export const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/platform', label: 'Platform' },
  { to: '/data', label: 'Live data' },
  { to: '/pearl-zones', label: 'Pearl data' },
  { to: '/docs', label: 'Docs' },
];

export const CONSOLE_PATH = '/console';
export const PROFILE_PATH = '/profile';

export const GITHUB_URL = 'https://github.com/Suryamoorthy-C/FLOATCHAT';

export const FOOTER_GROUPS = [
  {
    title: 'Product',
    links: [...NAV_ITEMS, { to: CONSOLE_PATH, label: 'Operations console' }],
  },
  {
    title: 'Data',
    links: [
      { to: '/data', label: 'Live fleet' },
      { to: '/data#anomalies', label: 'Anomaly signals' },
      { to: '/docs#api', label: 'API reference' },
      { to: '/docs#provenance', label: 'Provenance' },
    ],
  },
  {
    title: 'Elsewhere',
    links: [
      { to: GITHUB_URL, label: 'Source code', external: true },
      { to: '/docs#attribution', label: 'Attribution' },
      { to: '/platform#contact', label: 'Contact' },
    ],
  },
];
