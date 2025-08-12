# Dockerfile for TailwindsStatus production
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
ENV TZ="America/New_York"
COPY . .
RUN npm run build

# --- Production image ---
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app /app
RUN npm install --omit=dev
ENV TZ="America/New_York"
EXPOSE 5174
CMD ["node", "launch-prod.js"]
