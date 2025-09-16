# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No DATABASE_URL/API keys at build time -> falls back to the in-memory
# store + free hashing embedder + extractive answerer, which is all `next
# build` needs to statically analyze the app.
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S contextforge && adduser -S contextforge -G contextforge

COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

USER contextforge
EXPOSE 3000
ENV PORT=3000

CMD ["npm", "run", "start"]
