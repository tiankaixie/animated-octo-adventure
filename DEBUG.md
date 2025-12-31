# 调试指南

## 如何查看浏览器控制台

### Chrome / Edge
1. 按 `F12` 或 `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
2. 点击 "Console" 标签页
3. 刷新页面 (F5)

### Firefox
1. 按 `F12` 或 `Cmd+Option+K` (Mac) / `Ctrl+Shift+K` (Windows)
2. 点击 "控制台" 标签页
3. 刷新页面 (F5)

### Safari
1. 打开 Safari → 偏好设置 → 高级 → 勾选"在菜单栏中显示开发菜单"
2. 按 `Cmd+Option+C`
3. 刷新页面 (F5)

## 预期的控制台输出

如果一切正常，你应该看到：

```
DOM Content Loaded, initializing MLSharpApp...
MLSharpApp: Initializing...
MLSharpApp: DOM elements loaded {imageInput: true, processBtn: true, uploadArea: true}
MLSharpApp: Setting up event listeners...
MLSharpApp: Upload area elements {uploadArea: true, uploadLabel: true}
MLSharpApp: Event listeners setup complete!
MLSharpApp initialized successfully!
```

## 测试步骤

### 1. 测试文件选择
1. 点击上传区域
2. 选择一张图片
3. 查看控制台，应该看到：
   ```
   File input changed: FileList {0: File, length: 1}
   handleFileSelect called
   File selected: test.jpg image/jpeg 123456
   File validation passed, showing preview...
   FileReader loaded, updating preview
   Process button enabled
   ```

### 2. 测试拖拽上传
1. 从文件夹拖拽图片到上传区域
2. 查看控制台，应该看到：
   ```
   Drag over detected
   File dropped: FileList {0: File, length: 1}
   File input changed: FileList {0: File, length: 1}
   handleFileSelect called
   File selected: test.jpg image/jpeg 123456
   ...
   ```

## 常见问题诊断

### 问题 1: 没有任何控制台输出
**原因**: JavaScript 模块加载失败
**解决**:
- 检查网络标签页是否有 404 错误
- 确认服务器正在运行
- 检查浏览器是否支持 ES6 模块

### 问题 2: 看到 "imageInput not found"
**原因**: HTML 元素 ID 不匹配
**解决**:
- 检查 `frontend/index.html` 中是否有 `id="imageInput"`
- 刷新浏览器缓存 (Ctrl+Shift+R)

### 问题 3: 看到 "Upload area not found"
**原因**: CSS class 不匹配
**解决**:
- 检查 HTML 中是否有 `class="upload-area"`
- 检查页面是否完全加载

### 问题 4: 点击/拖拽无反应，但控制台正常
**原因**: 事件监听器可能被覆盖或 CSS 阻止点击
**解决**:
- 检查是否有其他 JavaScript 干扰
- 检查 CSS 是否有 `pointer-events: none`
- 检查元素是否被其他元素遮挡

### 问题 5: "File input changed" 显示但 handleFileSelect 不执行
**原因**: 文件验证失败或代码执行错误
**解决**:
- 查看控制台是否有红色错误信息
- 确认选择的是图片文件 (JPG/PNG)
- 确认文件小于 10MB

## 收集调试信息

如果问题仍未解决，请提供以下信息：

1. **浏览器信息**:
   - 浏览器名称和版本
   - 操作系统

2. **控制台输出**:
   - 完整的控制台日志
   - 任何红色的错误信息

3. **网络信息**:
   - 打开浏览器开发者工具的 "Network" 标签页
   - 刷新页面
   - 查看是否有红色的失败请求
   - 截图或复制失败的请求信息

4. **操作步骤**:
   - 详细描述你的操作步骤
   - 预期结果 vs 实际结果

## 快速测试命令

在浏览器控制台中运行以下命令测试元素是否存在：

```javascript
// 测试关键元素
console.log('imageInput:', document.getElementById('imageInput'));
console.log('processBtn:', document.getElementById('processBtn'));
console.log('upload-area:', document.querySelector('.upload-area'));
console.log('upload-label:', document.querySelector('.upload-label'));

// 测试文件输入是否可点击
document.getElementById('imageInput').click();
```
