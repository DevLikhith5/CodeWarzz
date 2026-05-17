import amqp, { ChannelModel, ConfirmChannel } from 'amqplib';
import logger from '../../config/logger.config';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://codewarz:codewarz@localhost:5672';
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

export class RabbitMQConnection {
    private static instance: RabbitMQConnection;
    private connection: ChannelModel | null = null;
    private channel: ConfirmChannel | null = null;
    private isConnecting = false;

    private constructor() {}

    static getInstance(): RabbitMQConnection {
        if (!RabbitMQConnection.instance) {
            RabbitMQConnection.instance = new RabbitMQConnection();
        }
        return RabbitMQConnection.instance;
    }

    async connect(): Promise<ConfirmChannel> {
        if (this.channel) return this.channel;
        if (this.isConnecting) {
            return new Promise((resolve) => {
                const check = setInterval(() => {
                    if (this.channel) {
                        clearInterval(check);
                        resolve(this.channel);
                    }
                }, 100);
            });
        }

        this.isConnecting = true;
        let retries = 0;

        while (retries < MAX_RETRIES) {
            try {
                logger.info(`Connecting to RabbitMQ → ${RABBITMQ_URL} (attempt ${retries + 1}/${MAX_RETRIES})`);
                this.connection = await amqp.connect(RABBITMQ_URL);
                this.channel = await this.connection.createConfirmChannel();
                await this.channel.prefetch(10);

                this.connection.on('close', () => {
                    logger.error('RabbitMQ connection closed');
                    this.channel = null;
                    this.connection = null;
                    setTimeout(() => this.connect(), RETRY_DELAY_MS);
                });

                this.connection.on('error', (err) => {
                    logger.error('RabbitMQ connection error', { error: err.message });
                });

                logger.info('RabbitMQ connected successfully');
                this.isConnecting = false;
                return this.channel;
            } catch (err: any) {
                retries++;
                logger.error(`RabbitMQ connection failed (attempt ${retries}/${MAX_RETRIES}): ${err.message}`);
                if (retries >= MAX_RETRIES) {
                    this.isConnecting = false;
                    throw new Error(`Failed to connect to RabbitMQ after ${MAX_RETRIES} attempts: ${err.message}`);
                }
                await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * retries));
            }
        }

        this.isConnecting = false;
        throw new Error('Failed to connect to RabbitMQ');
    }

    async getChannel(): Promise<ConfirmChannel> {
        if (!this.channel) {
            return this.connect();
        }
        return this.channel;
    }

    async close(): Promise<void> {
        if (this.channel) {
            await this.channel.close();
            this.channel = null;
        }
        if (this.connection) {
            await this.connection.close();
            this.connection = null;
        }
        logger.info('RabbitMQ connection closed');
    }
}

export const rabbitMQ = RabbitMQConnection.getInstance();
