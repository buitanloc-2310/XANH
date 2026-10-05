/**
 * Xanh Sky First platform manifest.
 * Runtime code lives in /functions (Cloudflare Pages Functions) and /public (client application).
 * This file centralizes architectural constants for maintainers and CI checks.
 */
export const PLATFORM = Object.freeze({
  name: 'Xanh Sky First',
  domain: 'xanh.skyfirst.io.vn',
  d1Binding: 'DB',
  d1Database: 'xanh',
  r2Binding: 'STORAGE',
  r2Bucket: 'xanh',
  passwordKdf: 'PBKDF2-SHA256',
  passwordIterations: 100000,
  managementCenter: 'Xanh Sky First Management Center',
  uploadFirst: true,
  imageUrlInputRequired: false
});
