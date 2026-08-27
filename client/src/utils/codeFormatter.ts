/**
 * Utility for formatting and normalizing fixture codes and pole codes.
 * Auto-pads single or multi-digit numbers to standard zero-padded format.
 * Examples:
 * - "lum-lerdo-5" -> "LUM-LERDO-0005"
 * - "lum-lerdo-45" -> "LUM-LERDO-0045"
 * - "pst-3" -> "PST-00003"
 */
export function formatFixtureCode(input: string): string {
  if (!input) return '';
  let cleaned = input.trim().toUpperCase();

  // Pattern: PREFIX-SUFFIX-NUM (e.g. LUM-LERDO-5 or BATCH-01-5)
  // Auto-pad last number to 4 digits for fixtures (LUM-...)
  cleaned = cleaned.replace(/^(LUM-[A-Z0-9]+-)(\d{1,3})$/, (_, prefix, num) => {
    return prefix + num.padStart(4, '0');
  });

  // Auto-pad last number to 5 digits for poles (PST-...)
  cleaned = cleaned.replace(/^(PST-)(\d{1,4})$/, (_, prefix, num) => {
    return prefix + num.padStart(5, '0');
  });

  return cleaned;
}
