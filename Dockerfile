# Dockerfile for TailwindsStatus production
FROM node:24-alpine as build
RUN apk add --no-cache python3 py3-pip make  g++ jpeg-dev cairo-dev giflib-dev pango-dev libtool autoconf automake ttf-opensans ttf-dejavu ttf-droid ttf-freefont ttf-liberation fontconfig
WORKDIR /app
COPY package*.json ./
RUN npm install
ENV TZ="America/New_York"
COPY . .
RUN npm run build

# --- Production image ---
FROM node:24-alpine
RUN apk add --no-cache python3 py3-pip make  g++ jpeg-dev cairo-dev giflib-dev pango-dev libtool autoconf automake ttf-opensans ttf-dejavu ttf-droid ttf-freefont ttf-liberation fontconfig
WORKDIR /app
COPY --from=build /app /app
RUN npm install --omit=dev
ENV TZ="America/New_York"
EXPOSE 5174
CMD ["node", "launch-prod.js"]
