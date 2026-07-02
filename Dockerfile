FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
RUN npm install

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV LINKA_HOST=0.0.0.0
ENV LINKA_PORT=3030
ENV LINKA_DB_PATH=/app/data/linka.sqlite
COPY package.json package-lock.json* ./
COPY apps/server/package.json apps/server/package.json
RUN npm install --omit=dev --workspace apps/server
COPY --from=build /app/dist ./dist
EXPOSE 3030
CMD ["npm", "run", "start", "-w", "apps/server"]
