FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
ENV PORT=8787 DB_FILE=/data/data.json
EXPOSE 8787
# Mount a persistent disk at /data so the database survives restarts. Set OWNER_KEY in the host's environment.
CMD ["node", "server/sync-server.mjs"]
