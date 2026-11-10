# SPA de producción: build de Vite contra el backend real (sin MSW) servido por nginx.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Mismo origen que el API Gateway: las rutas /api y /ws las enruta el gateway.
ARG VITE_API_BASE_URL=""
ARG VITE_REALTIME_URL="/ws"
ENV VITE_API_MOCKING=disabled \
    VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_REALTIME_URL=${VITE_REALTIME_URL}
RUN npm run build && rm -f dist/mockServiceWorker.js

FROM nginx:1.27-alpine
# Orígenes a los que la app se conecta (API, tiempo real y LiveKit): por defecto, el mismo origen
# del balanceador. Si alguno vive en otro, se agrega al arrancar, p. ej.
# docker run -e CSP_CONNECT_SRC="'self' wss://video.zeal.co" ...
ENV CSP_CONNECT_SRC="'self'"
COPY deploy/templates/ /etc/nginx/templates/
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/healthz || exit 1
