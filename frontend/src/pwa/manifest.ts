export const pwaManifest = {
  name: "Bianca's Adventures",
  short_name: 'Bianca',
  description: 'Le foto di famiglia geolocalizzate su una mappa in stile gioco.',
  start_url: '/',
  display: 'standalone' as const,
  background_color: '#0f1226',
  theme_color: '#2b5fad',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
};
