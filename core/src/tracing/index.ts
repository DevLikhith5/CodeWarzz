import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import logger from '../config/logger.config';

const SERVICE_NAME = process.env.SERVICE_NAME || 'core-service';
const JAEGER_ENDPOINT = process.env.JAEGER_URL || 'http://localhost:14268/api/traces';

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

    process.on('SIGTERM', () => {
        sdk?.shutdown()
            .then(() => logger.info('Tracing terminated'))
            .catch((error) => logger.error('Error terminating tracing', { error }))
            .finally(() => process.exit(0));
    });

    return sdk;
}

export { sdk };
