export function jaccardSimilarity(setA: Set<number>, setB: Set<number>): number {
    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;

    let intersection = 0;
    for (const item of setA) {
        if (setB.has(item)) {
            intersection++;
        }
    }

    const union = setA.size + setB.size - intersection;
    return intersection / union;
}

export function findSimilarSubmissions(
    targetFingerprint: Set<number>,
    candidates: Array<{ submissionId: string; fingerprint: Set<number> }>,
    threshold: number
): Array<{ submissionId: string; similarity: number }> {
    const similar: Array<{ submissionId: string; similarity: number }> = [];

    for (const candidate of candidates) {
        const similarity = jaccardSimilarity(targetFingerprint, candidate.fingerprint);
        if (similarity >= threshold) {
            similar.push({
                submissionId: candidate.submissionId,
                similarity: Math.round(similarity * 10000) / 10000,
            });
        }
    }

    similar.sort((a, b) => b.similarity - a.similarity);
    return similar;
}
