FROM node:18-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache \
    ffmpeg \
    curl \
    bash

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN mkdir -p public/hls logs

# Permisos para directorios
RUN chmod -R 755 public/hls

# Usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S wavy -u 1001 -G nodejs

# Cambiar ownership
RUN chown -R wavy:nodejs /app

USER wavy

# Exponer puertos
EXPOSE 3000 1935 8000 7880

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Comando de inicio
CMD ["node", "src/server.js"]