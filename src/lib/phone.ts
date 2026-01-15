const DEFAULT_COUNTRY_CODE = "972";

/**
 * Normalize a lenient phone input to digits-only international format.
 * - Allows spaces, hyphens, and leading plus
 * - Defaults to 972 when no country code is provided
 * - Returns null when input is invalid or too short/long
 */
export function normalizePhoneToE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (!cleaned) {
    return null;
  }

  // Only digits and optional leading "+"
  const plusCount = (cleaned.match(/\+/g) || []).length;
  if (plusCount > 1 || (plusCount === 1 && !cleaned.startsWith("+"))) {
    return null;
  }

  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1);
    if (!/^[0-9]+$/.test(digits)) {
      return null;
    }
    return isValidE164Digits(digits) ? digits : null;
  }

  // Digits only: handle explicit country code or local number
  if (!/^[0-9]+$/.test(cleaned)) {
    return null;
  }

  if (cleaned.startsWith(DEFAULT_COUNTRY_CODE)) {
    return isValidE164Digits(cleaned) ? cleaned : null;
  }

  let local = cleaned;
  if (local.startsWith("0")) {
    local = local.slice(1);
  }

  const withCountry = `${DEFAULT_COUNTRY_CODE}${local}`;
  return isValidE164Digits(withCountry) ? withCountry : null;
}

function isValidE164Digits(digits: string): boolean {
  // E.164 digits (no leading +): 8 to 15 digits total (no leading zero)
  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    return false;
  }
  return true;
}
