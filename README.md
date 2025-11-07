## ZIP 文件查看器 - React 前端工程（无构建）

本项目是一个基于 React 的 ZIP 文件查看器，可以解析 ZIP 文件并批量上传 PDF 到知识库。基于 CDN 方式加载 React 与 Babel，无需安装依赖或构建工具。

### 运行方式

**注意**：由于使用了外部脚本文件，必须通过 HTTP 服务器运行，不能直接双击打开 `index.html`。

```bash
# 方式一：Python 3
python3 -m http.server 5173
# 然后在浏览器访问：http://localhost:5173

# 方式二：Node（npx，可能需网络）
npx serve . -l 5173
# 然后在浏览器访问：http://localhost:5173
```

### 核心功能

- **环境切换**：
  - 支持测试环境和生产环境切换
  - 一键在导航栏切换环境
  - 不同环境使用独立的配置（域名、密钥等）

- **ZIP 文件解析**：
  - 上传 ZIP 文件，自动解析所有文件
  - 显示文件列表（文件名、大小、MD5）
  - 自动识别并高亮 PDF 文件
  - 智能过滤系统文件（`__MACOSX/`, `._*`, `.DS_Store`, `Thumbs.db`）
  - 支持显示/隐藏系统文件选项
  
- **批量上传到知识库**：
  - 一键上传所有 PDF 文件到 Tiefblue
  - 自动提交到知识库系统
  - 实时显示上传进度和 Upload Key
  - 可配置 User ID 和 Parent ID

### 目录结构

```
newlook/
├── index.html              # 主 HTML 文件
├── README.md               # 使用说明
├── config.json             # 配置文件（需自行创建，已在 .gitignore 中）
├── config.json.example     # 配置文件示例
├── css/
│   └── style.css          # 全局样式文件
├── js/
│   ├── app.js             # 主应用入口
│   └── components/        # React 组件目录
│       ├── Navbar.js      # 导航栏组件
│       └── ZipViewer.js   # ZIP 查看器组件
└── scripts/               # Python 工具脚本
    ├── upload_tos.py      # Tiefblue 文件上传脚本
    └── tos2kb.py          # TOS 知识库管理脚本
```

### 技术特点

- ✅ 基于 React 18，使用 Hooks
- ✅ CDN 加载，无需构建
- ✅ JSZip 解析 ZIP 文件
- ✅ CryptoJS 计算 MD5
- ✅ 异步上传，实时更新
- ✅ 响应式设计

### ZIP 查看器使用说明

ZIP 文件查看器集成了 Tiefblue 文件上传和知识库提交功能：

1. **启动服务器**：必须通过 HTTP 服务器运行（见上方运行方式）
2. **配置文件**：确保项目根目录有 `config.json` 文件（参见下方配置说明）
3. **选择环境**：在导航栏点击"测试环境"或"生产环境"标签切换
4. **上传 ZIP**：选择包含 PDF 文件的 ZIP 文件
5. **查看列表**：自动解析并显示所有文件，PDF 文件会被高亮标记
6. **填写参数**：在 User ID 和 Parent ID 输入框中填入对应的值
7. **上传并提交**：点击"上传并提交到知识库"按钮
8. **实时查看**：每个文件会依次经历两个步骤：
   - 步骤1：上传到 Tiefblue（显示 Upload Key）
   - 步骤2：提交到知识库（显示状态）

**完整流程**：
- 📂 解析 ZIP 文件 → 识别 PDF
- 📤 上传到 Tiefblue → 生成 Upload Key
- 📋 提交到知识库 → 完成入库
- ✅ 实时显示每个步骤的状态

**特点**：
- 🎯 自动识别 PDF 文件（黄色背景高亮）
- 🚫 智能过滤系统文件（`._*` 开头的 macOS 资源分支文件、`__MACOSX/`、`.DS_Store` 等）
- 🔗 两步流程：Tiefblue 上传 + 知识库提交
- 🔑 自动生成 UUID 作为唯一 Upload Key
- 📊 实时状态更新（上传到 Tiefblue... → 提交到知识库... → ✓ 完成）
- ❌ 失败提示详细错误信息
- 🔄 支持重新上传失败的文件

---

## Python 脚本工具

### 文件上传脚本 (`scripts/upload_tos.py`)

用于将本地文件批量上传到 Tiefblue 平台。

#### 配置说明

首次使用前，需要在项目根目录创建配置文件：

```bash
# 在项目根目录下
cp config.json.example config.json
# 编辑 config.json，填入你的实际配置
```

配置文件格式（支持测试/生产环境）：

```json
{
  "test": {
    "tiefblue": {
      "ak": "your-app-name",
      "sk": "your-secret-key",
      "tag": "your-tag-name",
      "domain": "https://tiefblue.test.dp.tech"
    },
    "knowledge_base": {
      "host": "https://literature-sage.test.bohrium.com",
      "token": ""
    }
  },
  "prod": {
    "tiefblue": {
      "ak": "your-app-name",
      "sk": "your-prod-secret-key",
      "tag": "your-tag-name",
      "domain": "https://tiefblue.dp.tech"
    },
    "knowledge_base": {
      "host": "https://literature-sage.bohrium.com",
      "token": ""
    }
  },
  "upload": {
    "default_base_path": "/path/to/your/files",
    "default_max_workers": 8,
    "default_file_pattern": "**/*.pdf"
  },
  "logging": {
    "log_file": "upload_tiefblue.log",
    "log_level": "ERROR"
  }
}
```

**配置说明**：
- `test`: 测试环境配置
  - `tiefblue`: Tiefblue 文件存储配置
    - `ak`: 应用名称
    - `sk`: 密钥（当前未使用，但保留）
    - `tag`: 标签名称
    - `domain`: Tiefblue 服务域名
  - `knowledge_base`: 知识库配置
    - `host`: 知识库 API 地址
    - `token`: Bearer 认证 token（可选，内网接口可留空）
- `prod`: 生产环境配置（结构同测试环境）
- `upload`: Python 脚本上传配置
- `logging`: 日志配置

#### 使用方法

```bash
# 安装依赖
pip install requests

# 上传单个文件
python scripts/upload_tos.py /path/to/file.pdf

# 上传目录下所有 PDF 文件
python scripts/upload_tos.py /path/to/directory

# 上传目录下特定类型文件
python scripts/upload_tos.py /path/to/directory "**/*.txt"
```

#### 主要功能

- ✅ 单文件上传
- ✅ 批量并发上传（可配置线程数）
- ✅ 自动计算 MD5 校验值
- ✅ 生成 CSV 结果报告
- ✅ 详细的进度显示和统计信息
- ✅ 错误日志记录

#### 代码调用

```python
from scripts.upload_tos import batch_upload_files

# 批量上传
results = batch_upload_files(
    base_path="/Users/dp/Downloads/pdfs",
    file_pattern="**/*.pdf",
    max_workers=8
)
```
