FROM node:18-alpine

WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências
RUN npm ci --only=production

# Copia o código fonte
COPY server.js ./

# Expoe a porta
EXPOSE 8000

# Comando para iniciar
CMD ["node", "server.js"]