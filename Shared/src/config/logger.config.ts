import winston from "winston";
import { getCorrelationId } from "../utils/helpers/request.helpers";
import DailyRotateFile from "winston-daily-rotate-file";
import LokiTransport from 'winston-loki';

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "HH:mm:ss" }),
    winston.format.printf(({ level, message, timestamp, ...data }) => {
        const correlationId = getCorrelationId();
        const cidString = correlationId ? ` [${correlationId}]` : " [system]";

        let dataString = "";
        if (Object.keys(data).length > 0) {
            if (data.error && data.error instanceof Error) {
                dataString = `\nError: ${data.error.message}\n${data.error.stack}`;
            } else {
                dataString = ` ${JSON.stringify(data)}`;
            }
        }

        return `${timestamp} ${level}${cidString}: ${message}${dataString}`;
    })
);

const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: "MM-DD-YYYY HH:mm:ss" }),
    winston.format.json(),
    winston.format.printf(({ level, message, timestamp, ...data }) => {
        const correlationId = getCorrelationId() || 'system';

        if (data.error && data.error instanceof Error) {
            data.error = {
                message: data.error.message,
                name: data.error.name,
                stack: data.error.stack,
            };
        }

        const output = {
            level,
            message,
            timestamp,
            correlationId,
            data
        };
        return JSON.stringify(output);
    })
);

const logger = winston.createLogger({
    transports: [
        new winston.transports.Console({
            format: consoleFormat
        }),
        new DailyRotateFile({
            filename: "logs/%DATE%-app.log",
            datePattern: "YYYY-MM-DD",
            maxSize: "20m",
            maxFiles: "14d",
            format: fileFormat
        }),
        new LokiTransport({
            host: process.env.LOKI_URL || 'http://localhost:3100',
            labels: { service: process.env.SERVICE_NAME || 'unknown-service' },
            json: true,
            format: fileFormat,
            replaceTimestamp: true,
            onConnectionError: (err) => console.error(err)
        })
    ]
});

export default logger;