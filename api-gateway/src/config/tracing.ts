import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

const SERVICE_NAME = process.env.SERVICE_NAME || 'api-gateway';
const JAEGER_ENDPOINT = process.env.JAEGER_URL || 'http://localhost:14268/api/traces';

let sdk: NodeSDK | null = null;

export function initTracing(): NodeSDK {
    if (sdk) return sdk;

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
            getNodeAutoInstrumentations({
                '@opentelemetry/instrumentation-http': {
                    ignoreIncomingPaths: ['/health', '/metrics'],
                },
            }),
        ],
    });

    sdk.start();

    console.log(`[API-GATEWAY] OpenTelemetry tracing initialized`, { jaegerEndpoint: JAEGER_ENDPOINT });

    process.on('SIGTERM', () => {
        sdk?.shutdown()
            .then(() => console.log('[API-GATEWAY] Tracing terminated'))
            .catch((error) => console.error('[API-GATEWAY] Error terminating tracing', error))
            .finally(() => process.exit(0));
    });

    return sdk;
}
