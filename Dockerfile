# Dockerfile for TailwindsStatus production
FROM node:24-alpine AS build

RUN apk add --no-cache \
	python3 \
	make \
	g++ \
	jpeg-dev \
	cairo-dev \
	giflib-dev \
	pango-dev \
	pixman-dev \
	fontconfig \
	ttf-opensans \
	ttf-dejavu \
	ttf-droid \
	ttf-freefont \
	ttf-liberation

WORKDIR /app
ENV TZ="America/New_York"

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build \
	&& npm prune --omit=dev \
	&& npm cache clean --force

FROM node:24-alpine AS runtime

RUN apk add --no-cache \
	cairo \
	jpeg \
	giflib \
	pango \
	pixman \
	fontconfig \
	ttf-opensans \
	ttf-dejavu \
	ttf-droid \
	ttf-freefont \
	ttf-liberation

WORKDIR /app
ENV NODE_ENV=production
ENV TZ="America/New_York"

COPY --from=build /app/package*.json ./
COPY --from=build /app/launch-prod.js ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src/backend ./src/backend

EXPOSE 5174
CMD ["node", "launch-prod.js"]
