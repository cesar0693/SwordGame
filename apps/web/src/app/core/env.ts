export const env = {
  apiBaseUrl:
    (window as unknown as { __SG_ENV?: { apiBaseUrl?: string } }).__SG_ENV?.apiBaseUrl ??
    'http://localhost:3000',
};
