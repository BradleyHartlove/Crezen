FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install build tools needed for go-sqlite and CGO (we use CGO_ENABLED=0 but deps may need)
RUN apk add --no-cache git

COPY go.mod ./
# Download deps using mod=mod since there's no go.sum yet — generated on first build
RUN GOFLAGS=-mod=mod go mod download all

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# ---- runtime image ----
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/server ./server

EXPOSE 8080
ENTRYPOINT ["./server"]
