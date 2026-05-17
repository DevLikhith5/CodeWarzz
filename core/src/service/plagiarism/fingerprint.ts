const DEFAULT_K = 5;
const DEFAULT_W = 4;

function rollingHash(tokens: string[], start: number, k: number): number {
    let hash = 0;
    for (let i = 0; i < k; i++) {
        if (start + i >= tokens.length) break;
        hash = ((hash * 31) + tokens[start + i].charCodeAt(0)) & 0xffffffff;
    }
    return hash;
}

function generateKGrams(tokens: string[], k: number): number[] {
    const hashes: number[] = [];
    for (let i = 0; i <= tokens.length - k; i++) {
        hashes.push(rollingHash(tokens, i, k));
    }
    return hashes;
}

export function winnowing(hashes: number[], w: number): Set<number> {
    const fingerprints = new Set<number>();

    for (let i = 0; i <= hashes.length - w; i++) {
        let minHash = hashes[i];

        for (let j = 1; j < w; j++) {
            if (i + j < hashes.length && hashes[i + j] < minHash) {
                minHash = hashes[i + j];
            }
        }

        fingerprints.add(minHash);
    }

    return fingerprints;
}

export function generateFingerprint(code: string, k: number = DEFAULT_K, w: number = DEFAULT_W): Set<number> {
    const tokens = code.split(' ').filter(t => t.length > 0);

    if (tokens.length < k) {
        return new Set();
    }

    const kGrams = generateKGrams(tokens, k);
    return winnowing(kGrams, w);
}
