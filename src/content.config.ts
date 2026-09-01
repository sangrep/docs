import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

const guideMetadata = z.object({
  status: z.enum(['Released', 'Preview', 'Unreleased']),
  platforms: z.array(z.enum(['Web', 'macOS', 'Windows'])).min(1),
  version: z.string().min(1),
  limitations: z.string().min(1),
  privacy: z.string().min(1),
  recovery: z.string().min(1),
  contentType: z.enum(['overview', 'task', 'reference', 'release', 'technical-reference']),
  expectedResult: z.string().min(1).optional(),
  technicalReference: z.url().optional(),
  canonicalSource: z.url().optional(),
  draft: z.boolean(),
  pagefind: z.boolean(),
});

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({ extend: guideMetadata }),
  }),
};
