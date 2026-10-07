# Apartment 4A: Next.js app run with `next start`.
# Runtime state lives in ./data (store.json) and ./workspace (the folder agents edit); mount volumes there.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app ./
RUN npm prune --omit=dev && mkdir -p data workspace && chown -R node:node data workspace
USER node
EXPOSE 3000
CMD ["npm", "start"]
