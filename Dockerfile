FROM node:17-slim
WORKDIR /
COPY ./package.json .
COPY ./package-lock.json .
RUN npm ci
COPY . .
CMD npm start