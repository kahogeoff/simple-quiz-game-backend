FROM node:16-alpine
WORKDIR /usr/src/backend
COPY ./backend/package.json ./backend/yarn.lock ./
RUN yarn install
COPY ./backend/ ./
EXPOSE 3001
CMD ["yarn", "run", "start"]