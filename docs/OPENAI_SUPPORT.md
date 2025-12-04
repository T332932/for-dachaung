# OpenAI API 支持说明

## 功能概述

系统现在支持**两种AI Provider**：

1. **Gemini API**（默认）
2. **OpenAI API**（或OpenAI兼容的API）

可以通过配置文件轻松切换。

---

## 配置方式

### 方式1：使用Gemini（默认）

```bash
# .env 文件
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-pro
```

### 方式2：使用OpenAI官方API

```bash
# .env 文件
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o
# OPENAI_BASE_URL 留空使用官方API
```

### 方式3：通过OpenAI兼容代理使用Gemini ⭐

这是最灵活的方式，可以使用项目自带的OpenAI兼容API作为代理：

```bash
# 终端1：启动OpenAI兼容代理
cd /Users/siyu/Applications/zujuan
npm install
GEMINI_API_KEY=your_key npm run dev
# 代理运行在 http://localhost:3000

# 终端2：配置后端使用代理
# .env 文件
AI_PROVIDER=openai
OPENAI_API_KEY=dummy_key  # 代理服务器可能不验证
OPENAI_MODEL=gemini-2.5-pro
OPENAI_BASE_URL=http://localhost:3000/v1
```

### 方式4：使用第三方OpenAI兼容服务

```bash
# 例如使用 OneAPI、LocalAI 等
AI_PROVIDER=openai
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=https://your-proxy-service.com/v1
```

---

## 优势

### 为什么支持OpenAI格式？

1. **统一接口** - 可以无缝切换不同的AI服务
2. **成本优化** - 根据价格选择最合适的服务
3. **备份方案** - 某个API服务故障时可以快速切换
4. **代理支持** - 通过代理使用被墙的服务

### OpenAI兼容代理的好处

项目自带的`src/index.js`可以作为：
- **OpenAI → Gemini 转换器** - 用OpenAI SDK调用Gemini
- **请求缓存层** - 减少重复API调用
- **速率限制** - 保护API配额
- **日志监控** - 统一记录所有AI请求

---

## 使用示例

### Python代码中使用

```python
from services.ai_service import get_ai_service

# 服务会根据配置自动选择provider
ai_service = get_ai_service()
result = await ai_service.analyze(uploaded_file)
```

### API调用

```bash
# 上传题目图片
curl -X POST http://localhost:8000/api/teacher/questions/analyze \
  -H "Content-Type: multipart/form-data" \
  -F "file=@question.jpg" \
  -H "Authorization: Bearer your_token"

# 后端会根据AI_PROVIDER配置自动使用Gemini或OpenAI
```

---

## 服务器部署配置

更新部署脚本中的.env配置：

```bash
# 选择provider（gemini或openai）
AI_PROVIDER=gemini

# Gemini配置
GEMINI_API_KEY=your_actual_key_here
GEMINI_MODEL=gemini-2.5-pro

# OpenAI配置（如需使用）
# OPENAI_API_KEY=sk-xxx
# OPENAI_MODEL=gpt-4o
# OPENAI_BASE_URL=  # 留空或填写代理URL
```

---

## 注意事项

1. **API Key安全** - 不要提交.env文件到Git
2. **模型兼容性** - 确保选择的模型支持vision（图片识别）
3. **代理配置** - 如使用代理，确保代理服务可访问
4. **成本控制** - OpenAI API按token收费，注意控制使用量

---

## 故障排查

### OpenAI API调用失败

```python
# 检查配置
echo $OPENAI_BASE_URL
echo $OPENAI_API_KEY

# 测试连接
curl -X POST $OPENAI_BASE_URL/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"test"}]}'
```

### 切换provider

只需修改.env文件中的`AI_PROVIDER`，然后重启服务：

```bash
docker-compose restart api
```
