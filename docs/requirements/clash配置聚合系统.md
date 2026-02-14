# Clash 配置聚合系统需求文档

## 功能目标

创建一个基于 TypeScript 的 Web 应用，支持创建多个聚合方案，每个方案可以管理一组 Clash 配置文件 URL，独立聚合节点信息，并通过方案名提供不同的配置文件供 Clash 客户端使用。

## 技术架构

- **前端**: Vue.js 3 + TypeScript + Vite
- **后端**: Node.js + Express + TypeScript
- **数据存储**: JSON 文件（轻量化存储）
- **配置解析**: YAML 解析库

## 核心功能需求

### 1. 多方案管理

#### 1.1 方案管理
- 创建/删除/编辑聚合方案
- 每个方案有唯一名称（用于 URL 路径）
- 方案描述和配置信息
- 方案启用/禁用状态

#### 1.2 方案独立性
- 每个方案独立管理配置文件 URL 列表
- 每个方案独立的节点聚合结果
- 每个方案可以有不同的聚合规则

### 2. Web UI 管理界面

#### 2.1 方案管理页面
- 方案列表展示（名称、描述、配置数量、状态）
- 新建方案对话框
- 方案编辑和删除操作
- 方案快速切换

#### 2.2 配置文件管理（方案维度）
- 在选定方案下添加/删除/编辑 Clash 配置文件 URL
- 为每个配置文件设置别名
- 显示配置文件状态（正常/异常/离线）
- 手动刷新单个或全部配置文件

#### 2.3 节点预览（方案维度）
- 显示当前方案的聚合节点列表
- 按来源配置文件分组展示
- 显示节点基本信息（名称、类型、延迟等）
- 节点连通性测试

#### 2.4 聚合配置管理
- 配置聚合规则（节点过滤、排序等）
- 自定义规则组和策略组
- 预览生成的最终配置文件
- 复制当前方案的聚合配置 URL

### 3. 后端 API 服务

#### 3.1 方案管理 API
- `GET /api/schemes` - 获取所有方案列表
- `POST /api/schemes` - 创建新方案
- `PUT /api/schemes/:name` - 更新方案信息
- `DELETE /api/schemes/:name` - 删除方案
- `GET /api/schemes/:name` - 获取指定方案详情

#### 3.2 配置文件管理 API（方案维度）
- `GET /api/schemes/:name/configs` - 获取方案下的所有配置文件
- `POST /api/schemes/:name/configs` - 添加配置文件到方案
- `PUT /api/schemes/:name/configs/:id` - 更新方案下的配置文件
- `DELETE /api/schemes/:name/configs/:id` - 删除方案下的配置文件
- `POST /api/schemes/:name/configs/:id/refresh` - 刷新指定配置文件

#### 3.3 聚合配置生成 API
- `GET /api/schemes/:name/clash` - 获取指定方案的聚合 Clash 配置文件（主要接口）
- `GET /api/schemes/:name/nodes` - 获取指定方案的聚合节点信息
- `POST /api/schemes/:name/nodes/test` - 测试指定方案的节点连通性
- `POST /api/schemes/:name/refresh-all` - 刷新方案下所有配置文件

#### 3.4 系统管理 API
- `GET /api/status` - 系统状态信息
- `POST /api/refresh-all` - 刷新所有方案的所有配置文件

### 4. 配置文件聚合逻辑（方案维度）

#### 4.1 配置获取
- 定时或手动拉取方案下的远程 Clash 配置文件
- 支持 HTTP/HTTPS 协议
- 处理认证（Bearer Token、Basic Auth）
- 错误重试机制

#### 4.2 节点聚合
- 合并方案下多个配置文件的 proxies 节点
- 去除重复节点（基于名称或服务器地址）
- 节点名称冲突处理（自动重命名）

#### 4.3 规则合并
- 合并 proxy-groups 代理组
- 保留或自定义 rules 规则
- 生成标准 Clash 配置格式

## URL 访问模式

### 方案聚合配置访问
```
GET /api/schemes/{方案名}/clash
```

**示例：**
- `http://localhost:3000/api/schemes/home/clash` - 获取名为 "home" 方案的聚合配置
- `http://localhost:3000/api/schemes/office/clash` - 获取名为 "office" 方案的聚合配置
- `http://localhost:3000/api/schemes/backup/clash` - 获取名为 "backup" 方案的聚合配置

## 技术方案选择

### 推荐方案：单体应用架构
- **优点**: 部署简单，开发快速，满足多方案需求
- **缺点**: 扩展性有限
- **适用**: 个人或小团队使用多套配置的场景

## 子任务拆解

### 第一阶段：项目初始化
1. 创建项目目录结构
2. 配置 TypeScript 开发环境
3. 搭建 Express 后端框架
4. 搭建 Vue.js 前端框架
5. 配置开发和构建脚本

### 第二阶段：后端核心功能
1. 实现方案管理 API
2. 实现配置文件管理 API（方案维度）
3. 实现配置文件拉取和解析逻辑
4. 实现节点聚合算法（方案维度）
5. 实现聚合配置生成 API
6. 添加错误处理和日志记录

### 第三阶段：前端界面开发
1. 创建方案管理页面
2. 创建配置管理页面（方案维度）
3. 创建节点预览页面（方案维度）
4. 创建系统状态页面
5. 实现 API 调用和状态管理
6. 添加响应式设计和用户体验优化

### 第四阶段：测试和优化
1. 单元测试编写
2. 集成测试
3. 性能优化
4. 错误处理完善
5. 文档编写

## 数据结构设计

### 方案数据结构
```typescript
interface Scheme {
  name: string;           // 方案名称（唯一标识）
  description: string;    // 方案描述
  enabled: boolean;       // 是否启用
  configs: Config[];      // 配置文件列表
  rules: AggregateRule;   // 聚合规则
  createdAt: Date;
  updatedAt: Date;
}
```

### 配置文件数据结构
```typescript
interface Config {
  id: string;            // 配置文件 ID
  name: string;          // 别名
  url: string;           // 配置文件 URL
  enabled: boolean;      // 是否启用
  lastFetch: Date;       // 最后获取时间
  status: 'success' | 'error' | 'pending';  // 状态
  error?: string;        // 错误信息
}
```

## 非功能性需求

- **性能**: 配置文件刷新时间 < 10s，UI 响应时间 < 1s
- **可靠性**: 支持配置文件获取失败重试，错误信息友好提示
- **安全性**: 输入验证，防止配置注入攻击，方案名称规范验证
- **可维护性**: 代码模块化，完整的错误日志和调试信息