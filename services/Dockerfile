# Build comum p/ os binários Go. Use --build-arg SVC=chat|origin|ingest|persist
FROM golang:1.23-alpine AS build
ARG SVC=chat
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/app ./cmd/${SVC}

# Runtime mínimo. O ingest precisa de ffmpeg → override no compose.
FROM alpine:3.20
RUN adduser -D -u 10001 app
COPY --from=build /out/app /usr/local/bin/app
USER app
ENTRYPOINT ["/usr/local/bin/app"]
