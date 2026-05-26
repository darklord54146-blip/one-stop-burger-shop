FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY public ./public
COPY db ./db

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/db.json

RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "server.js"]
