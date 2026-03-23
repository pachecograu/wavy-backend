FROM node:20-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache \
    curl \
    bash

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Copiar código fuente
COPY . .

# Usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S wavy -u 1001 -G nodejs

# Cambiar ownership
RUN chown -R wavy:nodejs /app

USER wavy

# Exponer puertos
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Comando de inicio
CMD ["node", "src/server.js"]