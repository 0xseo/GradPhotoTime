import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SEPARATOR = ":";

export function hashReservationPassword(password: string) {
  const normalizedPassword = password.trim();

  if (!normalizedPassword) {
    return null;
  }

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalizedPassword, salt, KEY_LENGTH).toString("hex");

  return `scrypt${SEPARATOR}${salt}${SEPARATOR}${hash}`;
}

export function verifyReservationPassword(password: string, storedHash: string) {
  try {
    const [algorithm, salt, hash] = storedHash.split(SEPARATOR);

    if (algorithm !== "scrypt" || !salt || !hash) {
      return false;
    }

    const expectedHash = Buffer.from(hash, "hex");
    const passwordHash = scryptSync(password.trim(), salt, KEY_LENGTH);

    return (
      expectedHash.length === passwordHash.length &&
      timingSafeEqual(expectedHash, passwordHash)
    );
  } catch {
    return false;
  }
}
