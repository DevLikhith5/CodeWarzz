import { normalizeCode, Language } from './tokenizer';
import { generateFingerprint } from './fingerprint';
import { findSimilarSubmissions } from './similarity';
import db from '../../config/db';
import { codeFingerprints, plagiarismReports } from '../../db/schema/plagiarism';
import { submissions } from '../../db/schema/submission';
import { eq, and, inArray } from 'drizzle-orm';
import logger from '../../config/logger.config';
import { serverConfig } from '../../config';

export interface PlagiarismCheckInput {
    submissionId: string;
    problemId: string;
    contestId?: string;
    code: string;
    language: Language;
}

export interface PlagiarismResult {
    submissionId: string;
    similarSubmissions: Array<{
        submissionId: string;
        similarity: number;
    }>;
    isFlagged: boolean;
    threshold: number;
}

export async function storeFingerprint(submissionId: string, language: string, normalizedCode: string, fingerprint: Set<number>): Promise<void> {
    await db.insert(codeFingerprints).values({
        submissionId,
        language,
        normalizedCode,
        fingerprintHashes: JSON.stringify(Array.from(fingerprint)),
    });
}

async function getFingerprintsForProblem(problemId: string, excludeSubmissionId?: string): Promise<Array<{ submissionId: string; fingerprint: Set<number> }>> {
    const problemSubmissions = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(eq(submissions.problemId, problemId));

    if (problemSubmissions.length === 0) return [];

    const submissionIds = problemSubmissions
        .map((s: { id: string }) => s.id)
        .filter((id: string) => id !== excludeSubmissionId);

    if (submissionIds.length === 0) return [];

    const fingerprints = await db
        .select()
        .from(codeFingerprints)
        .where(inArray(codeFingerprints.submissionId, submissionIds));

    return fingerprints.map((fp: { submissionId: string; fingerprintHashes: string }) => ({
        submissionId: fp.submissionId,
        fingerprint: new Set(JSON.parse(fp.fingerprintHashes) as number[]),
    }));
}

export async function checkPlagiarism(input: PlagiarismCheckInput): Promise<PlagiarismResult> {
    const threshold = serverConfig.PLAGIARISM_THRESHOLD;

    const normalizedCode = normalizeCode(input.code, input.language);
    const fingerprint = generateFingerprint(normalizedCode);

    await storeFingerprint(input.submissionId, input.language, normalizedCode, fingerprint);

    const candidates = await getFingerprintsForProblem(input.problemId, input.submissionId);

    const similarSubmissions = findSimilarSubmissions(fingerprint, candidates, threshold);

    const isFlagged = similarSubmissions.length > 0;

    if (isFlagged) {
        for (const similar of similarSubmissions) {
            await db.insert(plagiarismReports).values({
                submissionId1: input.submissionId,
                submissionId2: similar.submissionId,
                problemId: input.problemId,
                contestId: input.contestId || null,
                similarityScore: similar.similarity,
                flagged: true,
            });
        }

        logger.warn(`Plagiarism detected for submission ${input.submissionId}`, {
            similarCount: similarSubmissions.length,
            highestSimilarity: similarSubmissions[0]?.similarity,
        });
    }

    return {
        submissionId: input.submissionId,
        similarSubmissions,
        isFlagged,
        threshold,
    };
}

export async function getPlagiarismByProblem(problemId: string): Promise<any[]> {
    return db
        .select()
        .from(plagiarismReports)
        .where(eq(plagiarismReports.problemId, problemId))
        .orderBy(plagiarismReports.similarityScore);
}

export async function getPlagiarismByContest(contestId: string): Promise<any[]> {
    return db
        .select()
        .from(plagiarismReports)
        .where(eq(plagiarismReports.contestId, contestId))
        .orderBy(plagiarismReports.similarityScore);
}

export async function getPlagiarismBySubmission(submissionId: string): Promise<any[]> {
    return db
        .select()
        .from(plagiarismReports)
        .where(
            and(
                eq(plagiarismReports.submissionId1, submissionId),
                eq(plagiarismReports.flagged, true)
            )
        )
        .orderBy(plagiarismReports.similarityScore);
}
