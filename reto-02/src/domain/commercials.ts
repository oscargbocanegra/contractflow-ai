import type { Commercial } from "./contracts.js";
/** Resolve the exact catalog record without inventing a name, email or region. */
export function resolveCommercial(
  email: string,
  catalog: readonly Commercial[],
): Commercial | null {
  const record = catalog.find(
    (item) => item.email.toLowerCase() === email.trim().toLowerCase(),
  );
  return record ? { ...record } : null;
}
