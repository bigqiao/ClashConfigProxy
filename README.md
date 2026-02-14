# Clash 配置聚合系统

一个基于 TypeScript 的 Web 应用，支持创建多个聚合方案，每个方案可以管理一组 Clash 配置文件 URL，独立聚合节点信息，并通过方案名提供不同的配置文件供 Clash 客户端使用。

## 功能特性

- 🔰 **多方案管理**: 创建多个独立的配置聚合方案
- 📝 **Web UI 管理**: 直观的界面管理配置文件和查看节点
- 🔄 **智能聚合**: 支持节点去重、名称冲突处理等高级功能
- 🌐 **RESTful API**: 完整的 API 接口支持
- 📱 **响应式设计**: 支持桌面和移动设备访问

## 技术架构

- **前端**: Vue.js 3 + TypeScript + Element Plus + Vite
- **后端**: Node.js + Express + TypeScript
- **数据存储**: JSON 文件（轻量化）
- **配置解析**: YAML 解析

## 快速开始

### 安装依赖

```bash
npm run install-all
```

### 开发模式

```bash
npm run dev
```

这将同时启动前端开发服务器（localhost:5173）和后端服务器（localhost:8888）。

### 构建项目

```bash
npm run build
```

### 生产环境运行

```bash
npm run build
npm start
```

## 使用方法

### 1. 创建方案

1. 访问 `http://localhost:8888` 打开 Web 界面
2. 点击"方案管理"进入方案列表
3. 点击"新建方案"创建一个新的聚合方案
4. 输入方案名称和描述

### 2. 添加配置文件

1. 进入方案详情页面
2. 在"配置管理"标签页中点击"添加配置"
3. 输入配置名称和 Clash 配置文件的 URL
4. 保存配置

### 3. 获取聚合配置

方案启用后，可以通过以下 URL 获取聚合后的配置：

```
http://localhost:8888/api/schemes/{方案名}/clash
```

例如：
- `http://localhost:8888/api/schemes/home/clash`
- `http://localhost:8888/api/schemes/office/clash`

### 4. 在 Clash 中使用

将上述 URL 作为订阅链接添加到你的 Clash 客户端中。

## API 文档

### 方案管理

- `GET /api/schemes` - 获取所有方案
- `POST /api/schemes` - 创建新方案
- `GET /api/schemes/:name` - 获取指定方案
- `PUT /api/schemes/:name` - 更新方案
- `DELETE /api/schemes/:name` - 删除方案

### 配置文件管理

- `GET /api/schemes/:name/configs` - 获取方案配置列表
- `POST /api/schemes/:name/configs` - 添加配置文件
- `PUT /api/schemes/:name/configs/:id` - 更新配置文件
- `DELETE /api/schemes/:name/configs/:id` - 删除配置文件
- `POST /api/schemes/:name/configs/:id/refresh` - 刷新配置文件

### 聚合配置

- `GET /api/schemes/:name/clash` - 获取聚合的 Clash 配置（YAML格式）
- `GET /api/schemes/:name/nodes` - 获取聚合的节点信息（JSON格式）
- `POST /api/schemes/:name/refresh-all` - 刷新所有配置文件

## 项目结构

```
├── backend/           # 后端代码
│   ├── src/
│   │   ├── routes/    # API 路由
│   │   ├── services/  # 业务逻辑
│   │   ├── middleware/# 中间件
│   │   └── utils/     # 工具函数
│   └── package.json
├── frontend/          # 前端代码
│   ├── src/
│   │   ├── views/     # 页面组件
│   │   ├── stores/    # 状态管理
│   │   ├── api/       # API 调用
│   │   └── router/    # 路由配置
│   └── package.json
├── shared/            # 共享类型定义
│   └── src/types.ts
├── data/              # 数据文件目录
└── docs/              # 文档目录
```

## 聚合规则配置

每个方案支持以下聚合规则：

- **节点去重方式**:
  - `by_name`: 按节点名称去重
  - `by_server`: 按服务器地址去重
  - `none`: 不去重

- **名称冲突处理**:
  - `rename`: 自动重命名冲突节点
  - `skip`: 跳过冲突节点
  - `override`: 覆盖冲突节点

- **其他选项**:
  - `enabledOnly`: 仅聚合启用的配置文件

## 许可证

MIT License