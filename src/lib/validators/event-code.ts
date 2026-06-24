export function normalizeEventCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 10);
}

export function isEventCode(value: string) {
  return /^[A-Z0-9]{6,10}$/.test(normalizeEventCode(value));
}
