# ---- Build stage ----
# Compiles the Go application using alpine Linux for a lightweight build environment
FROM golang:1.26-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

# Copy dependency files first to leverage Docker layer caching
# This allows dependency layers to be cached separately from source code changes
COPY go.mod go.sum ./

ENV GOPROXY=https://proxy.golang.org,direct
ENV GOSUMDB=sum.golang.org
ENV GOFLAGS="-mod=mod"

RUN go mod download

# Copy entire source code into the build container
COPY . .

# Build the binary with CGO disabled for a static, portable executable
# GOOS=linux ensures the binary runs on Linux (target runtime environment)
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server ./cmd/server

# ---- Final stage ----
# Creates a minimal runtime image by copying only the compiled binary
# Uses alpine for a small final image size (~7MB vs ~300MB+ with full Go runtime)
FROM alpine:3.20

WORKDIR /app

# Install system dependencies required for runtime operations
# ca-certificates: needed for HTTPS/TLS connections (e.g., external APIs, SMTP)
# tzdata: provides timezone information for time-related operations
RUN apk add --no-cache ca-certificates tzdata

# Copy the pre-built binary from the build stage
COPY --from=builder /app/server .

# Expose the application port
EXPOSE 8081

# Start the server
CMD ["./server"]
