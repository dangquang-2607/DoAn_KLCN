import { expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { money, dateLabel, localDate, errorMessage, exportCsv } from '../lib/finance';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('formats decimal strings in VND without treating them as USD', () => {
  expect(money('1500000.00')).toContain('1.500.000');
  expect(money('1500000.00')).toContain('₫');
  expect(money('-50000.00')).toContain('-50.000');
});
it('keeps a calendar date unchanged', () => {
  expect(dateLabel('2026-09-09')).toBe('9/9/2026');
  expect(localDate(new Date(2026, 8, 9, 0, 5))).toBe('2026-09-09');
});
it('renders structured backend validation errors as text', () => {
  expect(errorMessage({ response: { data: { detail: [{ msg: 'Invalid amount' }] } } })).toBe('Invalid amount');
});
it('escapes CSV formulas, commas and quotes in exported user content', async () => {
  let output: Blob | undefined;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { output = blob as Blob; return 'blob:test'; });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal('document', { createElement: () => ({ click() {}, href: '', download: '' }) });
  exportCsv('test.csv', [['=CMD()', 'hello,"world"', 'Tiếng Việt']]);
  const text = await output!.text();
  expect(text).toContain('"\'=CMD()"');
  expect(text).toContain('"hello,""world"""');
  expect(text).toContain('Tiếng Việt');
});
it('keeps the two independently buildable design styles synchronized', () => {
  const source = readFileSync(new URL('../../shared/swiss.css', import.meta.url), 'utf8');
  expect(readFileSync(new URL('../app/swiss.css', import.meta.url), 'utf8')).toBe(source);
  expect(readFileSync(new URL('../../admin-web/src/swiss.css', import.meta.url), 'utf8')).toBe(source);
});
