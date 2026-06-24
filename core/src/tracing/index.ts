import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import logger from '../config/logger.config';

const SERVICE_NAME = process.env.SERVICE_NAME || 'core-service';
// The Jaeger collector HTTP endpoint is /api/traces. Append it if not already
// present so the env var override doesn't silently break tracing.
function buildJaegerEndpoint(): string {
    const raw = process.env.JAEGER_URL || 'http://localhost:14268';
    return raw.endsWith('/api/traces') ? raw : `${raw.replace(/\/$/, '')}/api/traces`;
}
const JAEGER_ENDPOINT = buildJaegerEndpoint();

let sdk: NodeSDK | null = null;

export function initTracing(): NodeSDK {
    if (sdk) return sdk;

    const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: SERVICE_NAME,
    });

    const jaegerExporter = new JaegerExporter({
        endpoint: JAEGER_ENDPOINT,
    });

    sdk = new NodeSDK({
        resource,
        spanProcessor: new SimpleSpanProcessor(jaegerExporter),
        instrumentations: [
            getNodeAutoInstrumentations({
                '@opentelemetry/instrumentation-http': {},
                '@opentelemetry/instrumentation-express': {},
                '@opentelemetry/instrumentation-pg': {
                    addSqlCommenterCommentToQueries: true,
                },
                '@opentelemetry/instrumentation-ioredis': {},
            }),
        ],
    });

    sdk.start();

    logger.info(`OpenTelemetry tracing initialized for ${SERVICE_NAME}`, { jaegerEndpoint: JAEGER_ENDPOINT });

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

export { sdk };
