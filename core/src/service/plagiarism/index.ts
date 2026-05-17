export { checkPlagiarism, getPlagiarismByProblem, getPlagiarismByContest, getPlagiarismBySubmission } from './plagiarism.service';
export type { PlagiarismCheckInput, PlagiarismResult } from './plagiarism.service';
export { normalizeCode } from './tokenizer';
export type { Language } from './tokenizer';
export { generateFingerprint, winnowing } from './fingerprint';
export { jaccardSimilarity, findSimilarSubmissions } from './similarity';
