FROM node:17-alpine
WORKDIR /
COPY ./package.json .
COPY ./package-lock.json .
RUN npm ci
COPY . .
CMD npm start
