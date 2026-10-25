FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# An empty value deliberately makes the client request /api/v1/... from its
# current origin. It is not a backend URL and contains no credentials.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine AS runtime
# Keep this outside /etc/nginx/templates: the stock Nginx entrypoint's broad
# envsubst hook would otherwise expand Nginx variables such as $host.
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
COPY docker-entrypoint.d/40-backend-upstream.sh /docker-entrypoint.d/40-backend-upstream.sh
COPY --from=build /app/dist /usr/share/nginx/html
RUN rm -f /etc/nginx/conf.d/default.conf \
    && chmod +x /docker-entrypoint.d/40-backend-upstream.sh
EXPOSE 80
