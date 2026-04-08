# 多阶段构建（前端 Vite + 后端 Express，同一进程托管 dist）

FROM node:18-alpine AS build
WORKDIR /app

# 先装依赖以获得更好的缓存命中
COPY package.json package-lock.json ./
RUN npm ci

# 再复制源码并构建前端产物
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# 仅安装生产依赖（运行后端所需）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 复制后端代码（含 schema.sql 等运行时文件）
COPY server/ ./server/

# 复制前端构建产物（由后端托管）
COPY --from=build /app/dist/ ./dist/

EXPOSE 4000

# 健康检查：Sealos 可用它判断容器是否就绪
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD sh -c "wget -qO- http://127.0.0.1:${PORT}/api/health >/dev/null 2>&1 || exit 1"

CMD ["node", "server/index.js"]