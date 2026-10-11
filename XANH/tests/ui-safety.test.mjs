import test from 'node:test';
import assert from 'node:assert/strict';
import { safeHref, safeImageSrc, isInternalHref } from '../public/ui-safety.js';

test('safeHref accepts supported navigation targets and rejects unsafe schemes', () => {
  assert.equal(safeHref('/du-an'), '/du-an');
  assert.equal(safeHref('/noi-dung/a?b=1'), '/noi-dung/a?b=1');
  assert.equal(safeHref('https://example.org/path'), 'https://example.org/path');
  assert.equal(safeHref('mailto:hello@example.org'), 'mailto:hello@example.org');
  assert.equal(safeHref('tel:+84 912 345 678'), 'tel:+84 912 345 678');
  assert.equal(safeHref('//evil.example'), '/');
  assert.equal(safeHref('javascript:alert(1)'), '/');
  assert.equal(safeHref('data:text/html,hello'), '/');
  assert.equal(safeHref('/safe\\\\evil'), '/');
  assert.equal(safeHref('/safe\r\nheader'), '/');
});

test('isInternalHref only marks safe same-site paths for client navigation', () => {
  assert.equal(isInternalHref('/tham-gia'), true);
  assert.equal(isInternalHref('https://example.org'), false);
  assert.equal(isInternalHref('//example.org'), false);
  assert.equal(isInternalHref('javascript:alert(1)'), false);
});

test('safeImageSrc permits known local media and approved HTTPS hero provider only', () => {
  const fallback = '/assets/xanh-sky-first-logo.png';
  assert.equal(safeImageSrc('/assets/illustrations/tree.png'), '/assets/illustrations/tree.png');
  assert.equal(safeImageSrc('/api/media/35'), '/api/media/35');
  assert.equal(safeImageSrc('https://images.unsplash.com/photo-123?auto=format'), 'https://images.unsplash.com/photo-123?auto=format');
  assert.equal(safeImageSrc('javascript:alert(1)'), fallback);
  assert.equal(safeImageSrc('data:image/svg+xml,<svg>'), fallback);
  assert.equal(safeImageSrc('//images.unsplash.com/photo-123'), fallback);
  assert.equal(safeImageSrc('/assets/../private.png'), fallback);
  assert.equal(safeImageSrc('https://evil.example/image.png'), fallback);
  assert.equal(safeImageSrc("https://images.unsplash.com/x');background:url(https://evil.example/x)"), fallback);
});
