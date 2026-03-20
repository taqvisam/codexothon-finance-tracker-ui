FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./
ARG VITE_API_URL=https://nondelusive-unemotionally-tommye.ngrok-free.dev
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN npm install -g serve@14.2.4

COPY --from=build /app/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
