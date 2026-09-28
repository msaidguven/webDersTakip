import { generateGeminiJson, type GeneratedJson } from '@/app/src/lib/geminiJsonGen';
import { CONTENT_WORKER_PROFILES, type ContentWorkerProfile } from '@/app/src/lib/contentWorkerProfiles';

export type GeneratedContentJson = GeneratedJson;

export async function generateTopicContentJson(
  prompt: string,
  profile: ContentWorkerProfile = CONTENT_WORKER_PROFILES.primary
): Promise<GeneratedContentJson> {
  return generateGeminiJson(prompt, profile);
}
