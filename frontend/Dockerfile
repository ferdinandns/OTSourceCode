# ---- Dependencies ----
FROM node:20.18-alpine AS deps
WORKDIR /app

# Registry default (npmjs.org) di-host di Cloudflare — kalau network kamu
# bermasalah ke Cloudflare, ganti ke mirror ini
RUN npm config set registry https://registry.npmmirror.com

COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder ----
FROM node:20.18-alpine AS builder
WORKDIR /app

COPY . .
COPY --from=deps /app/node_modules ./node_modules

# NEXT_PUBLIC_* di-bake saat build, jadi harus dikirim sebagai build arg
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MINIO_URL
ARG NEXT_PUBLIC_EMAIL_EMERTRACK
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MINIO_URL=$NEXT_PUBLIC_MINIO_URL
ENV NEXT_PUBLIC_EMAIL_EMERTRACK=$NEXT_PUBLIC_EMAIL_EMERTRACK

RUN npm run build

# ---- Runner ----
FROM node:20.18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]