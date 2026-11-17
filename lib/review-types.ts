import { z } from 'zod';
export const factIds = [
  'admission-no-known-allergies',
  'anesthesia-penicillin-rash',
  'allergy-records-conflict',
  'verification-required',
] as const;
export const noteAssessmentSchema = z.object({
  status: z.enum(['sufficient', 'revise', 'unsupported', 'irrelevant']),
  identifiesDiscrepancy: z.boolean(),
  accurate: z.boolean(),
  unsupportedClaims: z.array(z.string().max(300)).max(8),
  claims: z
    .array(
      z.object({
        quote: z.string().min(1).max(1000),
        factId: z.enum([...factIds, 'unsupported']),
        source: z.enum(['admission', 'anesthesia', 'comparison', 'none']),
      }),
    )
    .max(12),
  feedback: z.string().min(1).max(500),
  suggestedNote: z.string().max(1400),
  nextHint: z.string().max(400),
});
export type NoteAssessment = z.infer<typeof noteAssessmentSchema>;
export interface NoteReview extends NoteAssessment {
  id: string;
  input: string;
  kind: 'original' | 'edit';
  lang: 'en' | 'ar';
  createdAt: string;
  model: string;
  suggestionVerified: boolean;
  mode: 'live';
}
export interface VerificationRequest {
  id: string;
  patientId: 'PG-2048';
  status: 'pending-verification';
  concern: 'allergy-documentation';
  evidenceIds: string[];
  observation: string;
  message: string;
  lang: 'en' | 'ar';
  preparedAt: string;
  submittedAt: string | null;
  preparedBy: 'ai';
}
