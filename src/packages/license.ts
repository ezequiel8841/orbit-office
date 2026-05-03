// License validation — SHA-256 of the user-supplied key is compared
// against the hardcoded hash. The actual key is never stored here.

const EXPECTED_HASH = "bdb697ea7373aed45a87e480a80d626419ff8e387ae030aff40eaa57144a8a21";

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function validateLicenseKey(key: string): Promise<boolean> {
  try {
    const hash = await sha256hex(key.trim());
    return hash === EXPECTED_HASH;
  } catch {
    return false;
  }
}
