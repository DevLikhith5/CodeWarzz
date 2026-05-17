import db from '../config/db';
import { submissionEvents, contestEvents, userEvents, problemEvents } from '../db/schema/events';
import { eq, asc } from 'drizzle-orm';
import logger from '../config/logger.config';
import { publishEvent } from '../queues/rabbitmq';

export type EventEntity = 'submission' | 'contest' | 'user' | 'problem';

export interface EventPayload {
    [key: string]: any;
}

const EVENT_TABLES: Record<EventEntity, any> = {
    submission: submissionEvents,
    contest: contestEvents,
    user: userEvents,
    problem: problemEvents,
};

const ENTITY_ID_KEYS: Record<EventEntity, any> = {
    submission: submissionEvents.submissionId,
    contest: contestEvents.contestId,
    user: userEvents.userId,
    problem: problemEvents.problemId,
};

export async function appendEvent(
    entity: EventEntity,
    entityId: string,
    eventType: string,
    payload: EventPayload
): Promise<void> {
    const table = EVENT_TABLES[entity];
    const existingEvents = await db
        .select({ version: table.version })
        .from(table)
        .where(eq(ENTITY_ID_KEYS[entity], entityId))
        .orderBy(table.version)
        .limit(1);

    const lastVersion = existingEvents.length > 0 ? existingEvents[0].version : 0;
    const nextVersion = lastVersion + 1;

    await db.insert(table).values({
        [`${entity}Id`]: entityId,
        eventType,
        payload,
        version: nextVersion,
    });

    await publishEvent({
        entity,
        entityId,
        eventType,
        payload,
        version: nextVersion,
        timestamp: new Date().toISOString(),
    });

    logger.debug(`Event appended: ${entity}.${eventType} v${nextVersion}`, { entityId });
}

export async function getEventStream(entity: EventEntity, entityId: string): Promise<any[]> {
    const table = EVENT_TABLES[entity];

    const events = await db
        .select()
        .from(table)
        .where(eq(ENTITY_ID_KEYS[entity], entityId))
        .orderBy(asc(table.version));

    return events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        payload: e.payload,
        version: e.version,
        createdAt: e.createdAt,
    }));
}

export async function getLatestVersion(entity: EventEntity, entityId: string): Promise<number> {
    const table = EVENT_TABLES[entity];

    const result = await db
        .select({ version: table.version })
        .from(table)
        .where(eq(ENTITY_ID_KEYS[entity], entityId))
        .orderBy(table.version)
        .limit(1);

    return result.length > 0 ? result[0].version : 0;
}

export async function replayEvents(entity: EventEntity, entityId: string): Promise<EventPayload> {
    const events = await getEventStream(entity, entityId);

    if (events.length === 0) {
        throw new Error(`No events found for ${entity} ${entityId}`);
    }

    let state: EventPayload = {};

    for (const event of events) {
        state = applyEvent(state, event.eventType, event.payload);
    }

    return state;
}

function applyEvent(state: EventPayload, eventType: string, payload: EventPayload): EventPayload {
    switch (eventType) {
        case 'SUBMISSION_CREATED':
            return { ...state, ...payload, status: 'CREATED' };
        case 'SUBMISSION_QUEUED':
            return { ...state, status: 'QUEUED' };
        case 'SUBMISSION_EVALUATING':
            return { ...state, status: 'EVALUATING' };
        case 'SUBMISSION_COMPLETED':
            return { ...state, ...payload, status: 'COMPLETED' };
        case 'SUBMISSION_FLAGGED_PLAGIARISM':
            return { ...state, ...payload, status: 'FLAGGED' };
        case 'CONTEST_CREATED':
            return { ...state, ...payload, status: 'CREATED' };
        case 'CONTEST_STARTED':
            return { ...state, status: 'ACTIVE' };
        case 'CONTEST_ENDED':
            return { ...state, status: 'ENDED' };
        case 'CONTEST_FROZEN':
            return { ...state, status: 'FROZEN' };
        case 'USER_CREATED':
            return { ...state, ...payload };
        case 'USER_SOLVED_PROBLEM':
            return { ...state, ...payload };
        case 'USER_REGISTERED_CONTEST':
            return { ...state, ...payload };
        case 'PROBLEM_CREATED':
            return { ...state, ...payload, status: 'ACTIVE' };
        case 'PROBLEM_UPDATED':
            return { ...state, ...payload };
        case 'PROBLEM_DEPRECATED':
            return { ...state, status: 'DEPRECATED' };
        default:
            return { ...state, ...payload };
    }
}
