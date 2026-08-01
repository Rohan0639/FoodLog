/**
 * Conditional className joiner.
 *
 * Lives in its own module so the component files stay component-only, which is
 * what lets React Fast Refresh hot-swap them without a full reload.
 */
export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ');
