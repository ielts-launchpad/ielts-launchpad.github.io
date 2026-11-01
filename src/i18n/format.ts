/**
 * Minimal string interpolation for UI copy. Replaces `{name}` placeholders with
 * values. Keeps all visible text in `en.ts` while allowing dynamic numbers and
 * words (no external i18n dependency).
 */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
