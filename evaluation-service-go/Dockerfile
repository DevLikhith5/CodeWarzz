FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /worker ./cmd/worker
RUN CGO_ENABLED=0 GOOS=linux go build -o /api ./cmd/api

FROM alpine:3.19

RUN apk add --no-cache docker-cli

WORKDIR /app

COPY --from=builder /worker /app/worker
COPY --from=builder /api /app/api

EXPOSE 3003

CMD ["/app/worker"]
