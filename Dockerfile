# Dockerfile for TailwindsStatus production
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Production image ---
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app /app
RUN npm install --omit=dev
EXPOSE 5174
CMD ["node", "launch-prod.js"]
