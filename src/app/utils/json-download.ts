export function serializeJsonForDownload(data: unknown): string {
  return JSON.stringify(data, null, 4);
}
