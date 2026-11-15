import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Siddhi — IEP Tracking Platform',
    short_name: 'Siddhi',
    description: 'Individualized Education Program tracking for schools and guardians.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'any',
    background_color: '#f0f0eb',
    theme_color: '#f0f0eb',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/siddhi.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
