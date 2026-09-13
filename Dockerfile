FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --registry=https://registry.npmjs.org/
COPY . .
ENV NODE_ENV=production
CMD ["node", "server.js"]
