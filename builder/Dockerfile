FROM node:22-slim
WORKDIR /app
RUN npm install --registry=https://registry.npmjs.org/ --no-audit --no-fund esbuild@0.25.12 && npm cache clean --force
COPY server.mjs /app/server.mjs
EXPOSE 8080
CMD ["node", "/app/server.mjs"]
