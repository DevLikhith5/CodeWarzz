import db from "../config/db";
import { contests } from "../db/schema/contest";
import { problems } from "../db/schema/problems";
import { redis } from "../config/redis.config";
import logger from "../config/logger.config";

export const BLOOM_FILTER_SIZE = 100000; // 100k bits
export const BLOOM_HASHES = 3;

// Fast non-cryptographic hash to generate multiple bit offsets
export function getBloomOffsets(key: string): number[] {
    const offsets: number[] = [];
    let hash1 = 5381;
    let hash2 = 0;
    
    for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i);
        hash1 = ((hash1 << 5) + hash1) + char;
        hash2 = ((hash2 << 4) - hash2) ^ char;
    }
    
    hash1 = Math.abs(hash1);
    hash2 = Math.abs(hash2);
    
    for (let i = 0; i < BLOOM_HASHES; i++) {
        offsets.push((hash1 + i * hash2) % BLOOM_FILTER_SIZE);
    }
    
    return offsets;
}

export async function hydrateBloomFilters() {
    try {
        logger.info("Hydrating Bloom Filters in Redis...");
        
        // Fetch all valid IDs
        const contestIds = await db.select({ id: contests.id }).from(contests);
        const problemIds = await db.select({ id: problems.id }).from(problems);
        
        const pipeline = redis.pipeline();
        
        // Clear existing filters
        pipeline.del("gateway:bloom:contests");
        pipeline.del("gateway:bloom:problems");
        
        let contestBits = 0;
        let problemBits = 0;

        // Set bits for contests
        for (const { id } of contestIds) {
            const offsets = getBloomOffsets(id);
            for (const offset of offsets) {
                pipeline.setbit("gateway:bloom:contests", offset, 1);
                contestBits++;
            }
        }
        
        // Set bits for problems
        for (const { id } of problemIds) {
            const offsets = getBloomOffsets(id);
            for (const offset of offsets) {
                pipeline.setbit("gateway:bloom:problems", offset, 1);
                problemBits++;
            }
        }
        
        await pipeline.exec();
        
        logger.info("Bloom Filters hydrated successfully", { 
            contests: contestIds.length, 
            problems: problemIds.length,
            contestBits,
            problemBits
        });
    } catch (error: any) {
        logger.error("Failed to hydrate Bloom Filters", { error: error.message });
    }
}
