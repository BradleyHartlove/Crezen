# Stage 1: Build Rust WASM module
FROM rust:1.87-slim AS wasm-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install wasm-pack
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

WORKDIR /wasm

# Cache Cargo deps by building a stub first
COPY src/wasm/Cargo.toml ./
RUN mkdir src && printf '#[allow(dead_code)]\nfn _stub() {}' > src/lib.rs && \
    rustup target add wasm32-unknown-unknown && \
    cargo fetch

# Build the real crate
COPY src/wasm/src ./src/
RUN wasm-pack build --target web --release --out-dir /wasm-pkg

# Stage 2: Build React + Vite frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Inject the compiled WASM package
COPY --from=wasm-builder /wasm-pkg ./src/wasm/pkg/

RUN npm run build

# Stage 3: Serve with nginx
FROM nginx:1.27-alpine

COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
