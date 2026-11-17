# syntax=docker/dockerfile:1
# Imagen de MEGO FORCE Management System (portal publico + panel admin en un solo contenedor).

# ---------- Etapa 1: compilar y probar ----------
FROM node:22-alpine AS builder
WORKDIR /app

# Los subdominios se "hornean" en el frontend al compilar (no son secretos).
ARG VITE_PUBLIC_HOST=mego-registro.systemagencygarciavargas.tech
ARG VITE_ADMIN_HOST=mego-admin.systemagencygarciavargas.tech
ARG VITE_APP_MODE=
ENV VITE_PUBLIC_HOST=${VITE_PUBLIC_HOST} \
    VITE_ADMIN_HOST=${VITE_ADMIN_HOST} \
    VITE_APP_MODE=${VITE_APP_MODE}

# Aun no hay package-lock.json versionado: npm install genera uno aqui.
COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run lint \
 && npm run build \
 && npm test

# Quita las dependencias de desarrollo (vite, tailwind, tsx, etc.) para que la
# etapa final copie node_modules ya listo, sin volver a instalar nada.
# El servidor (dist-server/server.js) solo importa en produccion paquetes de
# "dependencies" (express, express-rate-limit, zod, xlsx, mammoth).
RUN npm prune --omit=dev --no-audit --no-fund \
 && npm cache clean --force

# ---------- Etapa 2: imagen final, solo produccion ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Sin npm ci ni npm install aqui: se reutiliza node_modules ya podado en la etapa
# de compilacion (misma imagen base, asi que los binarios nativos coinciden).
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

# Carpeta de mockups subidos (se monta como volumen en produccion)
RUN mkdir -p public/uploads/mockups \
 && chown -R node:node /app/public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist-server/server.js"]
