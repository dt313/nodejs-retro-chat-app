# 1. Stage: Build the TypeScript code
FROM node:20-alpine AS builder

# Tạo thư mục làm việc
WORKDIR /app

# Copy file cấu hình
COPY package*.json tsconfig.json ./

# Cài đặt dependencies
RUN npm install

# Copy mã nguồn
COPY src ./src

# Biên dịch TypeScript sang JavaScript
RUN npm run build

# 2. Stage: Run the built app in lightweight image
FROM node:20-alpine

# Làm việc trong thư mục /app
WORKDIR /app

# Copy chỉ các file cần thiết từ stage builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Cài production dependencies
RUN npm install --only=production

# Bắt đầu app
CMD ["node", "-r", "tsconfig-paths/register", "dist/server.js"]
