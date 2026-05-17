export const EXCHANGES = {
    SUBMISSION: 'submission.exchange',
    VERDICT: 'verdict.exchange',
    PLAGIARISM: 'plagiarism.exchange',
    EVENTS: 'events.exchange',
    DLX: 'dlx.exchange',
} as const;

export const QUEUES = {
    SUBMISSION: 'submission.queue',
    VERDICT: 'verdict.queue',
    PLAGIARISM: 'plagiarism.queue',
    SUBMISSION_DLQ: 'submission.dlq',
    VERDICT_DLQ: 'verdict.dlq',
    PLAGIARISM_DLQ: 'plagiarism.dlq',
} as const;

export const ROUTING_KEYS = {
    SUBMISSION: 'submission.route',
    VERDICT: 'verdict.route',
    PLAGIARISM: 'plagiarism.route',
    SUBMISSION_DLQ: 'submission.dlq.route',
    VERDICT_DLQ: 'verdict.dlq.route',
    PLAGIARISM_DLQ: 'plagiarism.dlq.route',
} as const;

export const QUEUE_CONFIG = {
    [QUEUES.SUBMISSION]: {
        maxPriority: 10,
        messageTtl: 300000,
        deadLetterExchange: EXCHANGES.DLX,
        deadLetterRoutingKey: ROUTING_KEYS.SUBMISSION_DLQ,
    },
    [QUEUES.VERDICT]: {
        messageTtl: 120000,
        deadLetterExchange: EXCHANGES.DLX,
        deadLetterRoutingKey: ROUTING_KEYS.VERDICT_DLQ,
    },
    [QUEUES.PLAGIARISM]: {
        messageTtl: 600000,
        deadLetterExchange: EXCHANGES.DLX,
        deadLetterRoutingKey: ROUTING_KEYS.PLAGIARISM_DLQ,
    },
} as const;

export const PRIORITY = {
    CONTEST: 10,
    PRACTICE: 1,
} as const;
