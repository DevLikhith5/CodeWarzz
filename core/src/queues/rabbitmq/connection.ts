import amqp, { ChannelModel, ConfirmChannel } from 'amqplib';
import logger from '../../config/logger.config';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://codewarz:codewarz@localhost:5672';
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

export class RabbitMQConnection {
    private static instance: RabbitMQConnection;
    private connection: ChannelModel | null = null;
    private channel: ConfirmChannel | null = null;
    private connectPromise: Promise<ConfirmChannel> | null = null;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private shuttingDown = false;

    private constructor() {}

    static getInstance(): RabbitMQConnection {
        if (!RabbitMQConnection.instance) {
            RabbitMQConnection.instance = new RabbitMQConnection();
        }
        return RabbitMQConnection.instance;
    }

    async connect(): Promise<ConfirmChannel> {
        if (this.channel) return this.channel;
        if (this.connectPromise) return this.connectPromise;

        this.connectPromise = this._connect();
        try {
            return await this.connectPromise;
        } finally {
            this.connectPromise = null;
        }
    }

    private async _connect(): Promise<ConfirmChannel> {
        let retries = 0;

        while (retries < MAX_RETRIES) {
            try {
                logger.info(`Connecting to RabbitMQ → ${RABBITMQ_URL} (attempt ${retries + 1}/${MAX_RETRIES})`);
                this.connection = await amqp.connect(RABBITMQ_URL);
                this.channel = await this.connection.createConfirmChannel();
                await this.channel.prefetch(10);

                this.connection.on('close', () => {
                    if (this.shuttingDown) return;
                    logger.error('RabbitMQ connection closed');
                    this.channel = null;
                    this.connection = null;
                    this.scheduleReconnect();
                });

                this.connection.on('error', (err) => {
                    logger.error('RabbitMQ connection error', { error: err.message });
                });

                logger.info('RabbitMQ connected successfully');
                return this.channel!;
            } catch (err: any) {
                retries++;
                logger.error(`RabbitMQ connection failed (attempt ${retries}/${MAX_RETRIES}): ${err.message}`);
                if (retries >= MAX_RETRIES) {
                    throw new Error(`Failed to connect to RabbitMQ after ${MAX_RETRIES} attempts: ${err.message}`);
                }
                await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * retries));
            }
        }

        throw new Error('Failed to connect to RabbitMQ');
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect().catch((err) => {
                logger.error('RabbitMQ reconnect failed', { error: err.message });
                // scheduleReconnect will be invoked again on the next 'close' event
            });
        }, RETRY_DELAY_MS);
    }

    async getChannel(): Promise<ConfirmChannel> {
        if (!this.channel) {
            return this.connect();
        }
        return this.channel;
    }

    async close(): Promise<void> {
        this.shuttingDown = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.channel) {
            try { await this.channel.close(); } catch { /* ignore */ }
            this.channel = null;
        }
        if (this.connection) {
            try { await this.connection.close(); } catch { /* ignore */ }
            this.connection = null;
        }
        logger.info('RabbitMQ connection closed');
    }
}

export const rabbitMQ = RabbitMQConnection.getInstance();
