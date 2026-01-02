import api from "../lib/api";

export interface ProblemStats {
    totalSubmissions: number;
    acceptedSubmissions: number;
}

export interface Problem {
    id: string;
    title: string;
    slug: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    tags: string[];
    createdAt: string;
    stats: ProblemStats;
}

export interface PaginatedProblems {
    data: Problem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface Testcase {
    id: string;
    input: string;
    output: string;
    isSample: boolean;
}

export interface ProblemDetail extends Problem {
    description: string;
    timeLimitMs: number;
    memoryLimitMb: number;
    cpuLimit: number;
    stackLimitMb: number;
    hints: string[];
    testcases: Testcase[];
}

class ProblemRepository {
    async getProblems(page = 1, limit = 10): Promise<PaginatedProblems> {
        const response = await api.get<{ success: boolean; data: PaginatedProblems }>(`/problems?page=${page}&limit=${limit}`);
        return response.data.data;
    }

    async getProblemBySlug(slug: string): Promise<ProblemDetail> {
        const response = await api.get<{ success: boolean; data: ProblemDetail }>(`/problems/slug/${slug}`);
        return response.data.data;
    }

    async getProblemById(id: string): Promise<ProblemDetail> {
        const response = await api.get<{ success: boolean; data: ProblemDetail }>(`/problems/${id}`);
        return response.data.data;
    }
}

export const problemRepository = new ProblemRepository();
