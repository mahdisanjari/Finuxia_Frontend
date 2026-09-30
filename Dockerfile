# --- build stage: compile the Vite app ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# `npm install` (not `npm ci`) so a newly-added dependency resolves even if the
# committed lockfile is momentarily behind package.json.
RUN npm install
COPY . .
# Vite reads .env.production (VITE_API_URL) automatically during build.
RUN npm run build

# --- serve stage: static files via nginx on Cloud Run's port 8080 ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
