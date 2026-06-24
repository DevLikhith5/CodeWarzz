import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import logger from './logger.config';

const SERVICE_NAME = process.env.SERVICE_NAME || 'api-gateway';
function buildJaegerEndpoint(): string {
    const raw = process.env.JAEGER_URL || 'http://localhost:14268';
    return raw.endsWith('/api/traces') ? raw : `${raw.replace(/\/$/, '')}/api/traces`;
}
const JAEGER_ENDPOINT = buildJaegerEndpoint();

let sdk: NodeSDK | null = null;

export function initTracing(): NodeSDK | null {
    if (process.env.NODE_ENV === 'test') return null;
    if (sdk) return sdk;

    // Dynamic import to avoid TS type-only export issues with Resource
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resource } = require('@opentelemetry/resources');
    const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    });

    const jaegerExporter = new JaegerExporter({
        endpoint: JAEGER_ENDPOINT,
    });

    sdk = new NodeSDK({
        resource,
        spanProcessor: new SimpleSpanProcessor(jaegerExporter),
        instrumentations: [
            getNodeAutoInstrumentations(),
        ],
    });

    sdk.start();

    logger.info(`[API-GATEWAY] OpenTelemetry tracing initialized`, { jaegerEndpoint: JAEGER_ENDPOINT });

    return sdk;
}

export async function shutdownTracing() {
    if (sdk) {
        try {
            await sdk.shutdown();
            logger.info('Tracing terminated');
        } catch (error: any) {
            logger.error('Error terminating tracing', { error: error.message });
        }
    }
}
