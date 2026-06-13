FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npx prisma generate

RUN mkdir -p logs uploads backups

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "index.js"]
