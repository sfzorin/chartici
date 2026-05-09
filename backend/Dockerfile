FROM node:22-alpine
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --production
COPY backend ./backend
COPY src ./src
WORKDIR /app/backend
EXPOSE 3001
CMD ["node", "server.js"]
