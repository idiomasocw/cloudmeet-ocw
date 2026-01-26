export function getLiveKitURL(
  projectUrl: string,
  region: string | null
): string {
  // For self-hosted LiveKit, region parameter is ignored
  return projectUrl;
}
