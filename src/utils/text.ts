export function redactToken(token: string | null | undefined): string {
  if (!token) return "";
  if (token.length <= 8) return "********";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export function ensureTrailingSlashless(value: string): string {
  return value.replace(/\/+$/, "");
}

export function errorToText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
