import { normalizeCode, Language } from './tokenizer';
import { generateFingerprint } from './fingerprint';
import { findSimilarSubmissions } from './similarity';
import db from '../../config/db';
import { codeFingerprints, plagiarismReports } from '../../db/schema/plagiarism';
import { submissions } from '../../db/schema/submission';
import { eq, and, ne } from 'drizzle-orm';
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
    // Use ON CONFLICT to make the store idempotent. If a redelivered queue
    // message tries to insert a fingerprint for a submission that already
    // has one, the conflict is silently ignored and the existing
    // fingerprint is preserved.
    await db
        .insert(codeFingerprints)
        .values({
            submissionId,
            language,
            normalizedCode,
            fingerprintHashes: JSON.stringify(Array.from(fingerprint)),
        })
        .onConflictDoNothing({ target: codeFingerprints.submissionId });
}

async function getFingerprintsForProblem(problemId: string, excludeSubmissionId?: string): Promise<Array<{ submissionId: string; fingerprint: Set<number> }>> {
    // Single query: get problem submissions EXCLUDING the current one, joined
    // with their fingerprints. Avoids the N+1 of "fetch all submissions,
    // then fetch all fingerprints".
    const rows = await db
        .select({
            submissionId: codeFingerprints.submissionId,
            fingerprintHashes: codeFingerprints.fingerprintHashes,
        })
        .from(codeFingerprints)
        .innerJoin(submissions, eq(codeFingerprints.submissionId, submissions.id))
        .where(
            excludeSubmissionId
                ? and(eq(submissions.problemId, problemId), ne(codeFingerprints.submissionId, excludeSubmissionId))
                : eq(submissions.problemId, problemId)
        );

    return rows.map((row) => ({
        submissionId: row.submissionId,
        fingerprint: new Set(JSON.parse(row.fingerprintHashes) as number[]),
    }));
}

export async function checkPlagiarism(input: PlagiarismCheckInput): Promise<PlagiarismResult> {
    const threshold = serverConfig.PLAGIARISM_THRESHOLD;

    const normalizedCode = normalizeCode(input.code, input.language);
    const fingerprint = generateFingerprint(normalizedCode);

    // Store fingerprint idempotently (outside the main transaction because
    // it's a single insert and any duplicate is a no-op).
    await storeFingerprint(input.submissionId, input.language, normalizedCode, fingerprint);

    const candidates = await getFingerprintsForProblem(input.problemId, input.submissionId);

    const similarSubmissions = findSimilarSubmissions(fingerprint, candidates, threshold);

    const isFlagged = similarSubmissions.length > 0;

    if (isFlagged) {
        // Bulk insert all reports in a single statement + transaction.
        // Each report is a (submission1, submission2, problem) row; we
        // pre-aggregate by (submission2, similarity) so the same pair is
        // never inserted twice.
        const reportRows = similarSubmissions.map((similar) => ({
            submissionId1: input.submissionId,
            submissionId2: similar.submissionId,
            problemId: input.problemId,
            contestId: input.contestId || null,
            similarityScore: similar.similarity,
            flagged: true,
        }));

        try {
            await db.transaction(async (tx) => {
                await tx
                    .insert(plagiarismReports)
                    .values(reportRows)
                    .onConflictDoNothing();
            });
        } catch (err: any) {
            // Don't fail the whole check if the report write fails; the
            // fingerprint has been stored and the result is still valid.
            logger.error('Failed to write plagiarism reports', {
                submissionId: input.submissionId,
                error: err.message,
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
