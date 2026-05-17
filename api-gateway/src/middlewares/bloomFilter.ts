import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis.conifg";
import logger from "../config/logger.config";

export const BLOOM_FILTER_SIZE = 100000;
export const BLOOM_HASHES = 3;

function getBloomOffsets(key: string): number[] {
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

/**
 * Probabilistic malicious traffic shedding.
 * Checks Redis Bloom Filters before allowing requests to reach microservices.
 * If the filter says "Definitively Not Present", we return 404 without touching the DB.
 */
export const bloomFilterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let filterKey: string | null = null;
        let idToCheck: string | null = null;

        // Match routes like /api/v1/contests/:id or /api/v1/problems/:id
        const contestMatch = req.url.match(/\/contests\/([a-zA-Z0-9-]+)/);
        const problemMatch = req.url.match(/\/problems\/([a-zA-Z0-9-]+)/);

        if (contestMatch) {
            filterKey = "gateway:bloom:contests";
            idToCheck = contestMatch[1];
        } else if (problemMatch) {
            filterKey = "gateway:bloom:problems";
            idToCheck = problemMatch[1];
        }

        // If it's not a known entity route, pass through
        if (!filterKey || !idToCheck || idToCheck === "live" || idToCheck === "stream" || idToCheck === "archive") {
            return next();
        }

        const offsets = getBloomOffsets(idToCheck);
        
        // Execute O(1) bit checks
        const pipeline = redis.pipeline();
        for (const offset of offsets) {
            pipeline.getbit(filterKey, offset);
        }
        
        const results = await pipeline.exec();
        
        // If ANY bit is 0, the item absolutely does NOT exist in the database.
        for (const [err, bit] of results ?? []) {
            if (bit === 0) {
                logger.warn("Bloom Filter Shedding: Dropped malicious/invalid request", { 
                    type: filterKey, 
                    id: idToCheck 
                });
                return res.status(404).json({
                    success: false,
                    message: "Resource not found (Blocked at edge via Bloom Filter)"
                });
            }
        }

        // If all bits are 1, it *probably* exists. Pass to the actual service.
        next();
    } catch (error) {
        logger.error("Bloom Filter middleware error", { error });
        next(); // Fail open so we don't break the app if Redis blips
    }
};
