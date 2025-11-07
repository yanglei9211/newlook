// ZIP 文件查看器组件
function ZipViewer({ environment }) {
  const { useState, useEffect } = React;

  const [allFiles, setAllFiles] = useState([]); // 存储所有文件（包括系统文件）
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSystemFiles, setShowSystemFiles] = useState(false);
  const [config, setConfig] = useState(null); // 完整配置
  const [currentEnvConfig, setCurrentEnvConfig] = useState(null); // 当前环境配置
  const [uploadingCount, setUploadingCount] = useState(0); // 正在上传的文件数
  const [zipInstance, setZipInstance] = useState(null); // 保存 ZIP 实例用于后续读取文件
  const [userId, setUserId] = useState('113776'); // 用户 ID
  const [parentId, setParentId] = useState('123662'); // 父级 ID

  // 加载配置文件
  useEffect(() => {
    fetch('/config.json')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error('加载配置文件失败:', err));
  }, []);

  // 根据环境切换配置
  useEffect(() => {
    if (config && environment) {
      setCurrentEnvConfig(config[environment]);
    }
  }, [config, environment]);

  // 判断是否为系统文件（macOS 自动添加的文件）
  function isSystemFile(fileName) {
    // 获取文件名（去掉路径）
    const baseName = fileName.split('/').pop();
    
    // 过滤 __MACOSX/ 开头的文件（macOS 元数据）
    if (fileName.startsWith('__MACOSX/')) {
      return true;
    }
    // 过滤以 ._ 开头的文件（macOS 资源分支/AppleDouble 文件）
    if (baseName.startsWith('._')) {
      return true;
    }
    // 过滤 .DS_Store 文件（macOS 文件夹元数据）
    if (fileName === '.DS_Store' || fileName.endsWith('/.DS_Store')) {
      return true;
    }
    // 过滤 Thumbs.db（Windows 缩略图缓存）
    if (fileName === 'Thumbs.db' || fileName.endsWith('/Thumbs.db')) {
      return true;
    }
    return false;
  }

  // 计算 MD5（使用浏览器 crypto API）
  async function calculateMD5(arrayBuffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    // 由于浏览器 crypto API 不支持 MD5，我们使用 SHA-256 的前16字节作为替代
    // 或者可以使用 crypto-js 库
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 使用 crypto-js 计算 MD5（如果可用）
  async function calculateMD5WithCryptoJS(arrayBuffer) {
    if (typeof CryptoJS !== 'undefined') {
      // 将 ArrayBuffer 转换为 Uint8Array，然后转换为 WordArray
      const uint8Array = new Uint8Array(arrayBuffer);
      const wordArray = CryptoJS.lib.WordArray.create(uint8Array);
      return CryptoJS.MD5(wordArray).toString();
    }
    // 降级方案：使用 SHA-256 的前16字节
    return calculateMD5(arrayBuffer);
  }

  // 格式化文件大小
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // 判断是否为 PDF 文件
  function isPdfFile(fileName) {
    return fileName.toLowerCase().endsWith('.pdf');
  }

  // 生成 UUID
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // 上传单个 PDF 文件到 Tiefblue
  async function uploadPdfToTiefblue(file) {
    if (!currentEnvConfig) {
      throw new Error('配置未加载');
    }

    const fileName = file.name.split('/').pop(); // 获取文件名（去掉路径）
    const uploadKey = `knowledge_base/${generateUUID()}/${fileName}`;
    const url = `${currentEnvConfig.tiefblue.domain}/api/v2/file/${currentEnvConfig.tiefblue.ak}/${currentEnvConfig.tiefblue.tag}/${uploadKey}`;

    // 从 ZIP 中读取文件数据
    const fileData = await file.zipEntry.async('arraybuffer');

    // 上传到 Tiefblue
    const response = await fetch(url, {
      method: 'PUT',
      body: fileData,
      headers: {
        'Content-Type': 'application/pdf'
      }
    });

    if (!response.ok) {
      throw new Error(`上传失败: ${response.status} ${response.statusText}`);
    }

    return uploadKey;
  }

  // 提交文件到知识库
  async function submitToKnowledgeBase(file, uploadKey) {
    if (!currentEnvConfig || !currentEnvConfig.knowledge_base) {
      throw new Error('知识库配置未加载');
    }

    if (!userId || !parentId) {
      throw new Error('请填写 User ID 和 Parent ID');
    }

    const url = `${currentEnvConfig.knowledge_base.host}/api/v1/file/submit`;
    const fileName = file.name.split('/').pop();

    const payload = {
      url: uploadKey,
      fileName: fileName,
      parentId: parseInt(parentId),
      size: file.size,
      md5: file.md5
    };

    // 构建请求头，token 为可选
    const headers = {
      'Content-Type': 'application/json',
      'X-User-ID': userId
    };

    // 如果配置了 token，则添加 Authorization 头
    if (currentEnvConfig.knowledge_base.token) {
      headers['Authorization'] = `Bearer ${currentEnvConfig.knowledge_base.token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`提交失败: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  // 批量上传 PDF 文件
  async function handleUploadPdfs() {
    if (!currentEnvConfig) {
      setError('配置文件未加载，无法上传');
      return;
    }

    if (!userId || !parentId) {
      setError('请填写 User ID 和 Parent ID');
      return;
    }

    // 筛选出 PDF 文件且未上传的，同时过滤掉系统文件
    const pdfFiles = allFiles.filter(file => 
      isPdfFile(file.name) && 
      !isSystemFile(file.name) && 
      !file.uploadKey && 
      !file.uploadStatus
    );

    if (pdfFiles.length === 0) {
      setError('没有需要上传的 PDF 文件');
      return;
    }

    setError('');
    setUploadingCount(pdfFiles.length);

    // 逐个上传（保证实时更新）
    for (const file of pdfFiles) {
      try {
        // 更新状态为"上传中"
        setAllFiles(prevFiles => 
          prevFiles.map(f => 
            f.name === file.name 
              ? { ...f, uploadStatus: '上传到 Tiefblue...' }
              : f
          )
        );

        // 步骤1: 上传到 Tiefblue
        const uploadKey = await uploadPdfToTiefblue(file);

        // 更新状态：Tiefblue 上传成功，准备提交到知识库
        setAllFiles(prevFiles => 
          prevFiles.map(f => 
            f.name === file.name 
              ? { ...f, uploadKey, uploadStatus: '提交到知识库...' }
              : f
          )
        );

        // 步骤2: 提交到知识库
        await submitToKnowledgeBase(file, uploadKey);

        // 更新状态为完全成功
        setAllFiles(prevFiles => 
          prevFiles.map(f => 
            f.name === file.name 
              ? { ...f, uploadKey, uploadStatus: '✓ 完成', kbStatus: 'success' }
              : f
          )
        );

        setUploadingCount(prev => prev - 1);
      } catch (err) {
        console.error(`上传失败 ${file.name}:`, err);
        // 更新状态为失败
        setAllFiles(prevFiles => 
          prevFiles.map(f => 
            f.name === file.name 
              ? { ...f, uploadStatus: `✗ 失败: ${err.message}`, kbStatus: 'failed' }
              : f
          )
        );
        setUploadingCount(prev => prev - 1);
      }
    }
  }

  // 处理文件上传
  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('请上传 ZIP 文件');
      return;
    }

    setLoading(true);
    setError('');
    setAllFiles([]);

    try {
      // 读取 ZIP 文件
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      setZipInstance(zip); // 保存 ZIP 实例

      // 收集所有文件条目（不过滤，全部收集）
      const fileEntries = [];
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          fileEntries.push({ relativePath, zipEntry });
        }
      });

      // 并行处理所有文件
      const promises = fileEntries.map(async ({ relativePath, zipEntry }) => {
        // 读取文件内容并计算 MD5
        const fileData = await zipEntry.async('arraybuffer');
        const md5 = await calculateMD5WithCryptoJS(fileData);
        return {
          name: relativePath,
          size: zipEntry._data?.uncompressedSize || fileData.byteLength,
          md5: md5,
          zipEntry: zipEntry, // 保存 zipEntry 引用，用于后续上传
          uploadKey: null,
          uploadStatus: null
        };
      });

      // 等待所有 MD5 计算完成
      const results = await Promise.all(promises);
      setAllFiles(results.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError('读取 ZIP 文件失败：' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: '1000px' }}>
      <h2>ZIP 文件查看器</h2>
      
      <div className="row">
        <input
          type="file"
          accept=".zip"
          onChange={handleFileUpload}
          disabled={loading}
          style={{ padding: '8px', cursor: loading ? 'not-allowed' : 'pointer' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ fontSize: '13px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
            User ID
          </label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="请输入 User ID"
            disabled={loading || uploadingCount > 0}
            style={{ 
              width: '100%',
              padding: '6px 10px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '6px'
            }}
          />
        </div>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ fontSize: '13px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
            Parent ID
          </label>
          <input
            type="text"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            placeholder="请输入 Parent ID"
            disabled={loading || uploadingCount > 0}
            style={{ 
              width: '100%',
              padding: '6px 10px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '6px'
            }}
          />
        </div>
      </div>

      <div className="row" style={{ marginTop: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#6b7280' }}>
          <input
            type="checkbox"
            checked={showSystemFiles}
            onChange={(e) => setShowSystemFiles(e.target.checked)}
            disabled={loading}
          />
          显示系统文件（__MACOSX/、.DS_Store 等）
        </label>
      </div>

      {loading && (
        <div style={{ marginTop: '12px', color: '#6b7280' }}>
          正在解析 ZIP 文件...
        </div>
      )}

      {error && (
        <div className="result error" style={{ marginTop: '12px' }}>
          {error}
        </div>
      )}

      {(() => {
        // 根据 showSystemFiles 选项过滤文件
        const displayFiles = showSystemFiles 
          ? allFiles 
          : allFiles.filter(file => !isSystemFile(file.name));
        
        const pdfCount = displayFiles.filter(f => isPdfFile(f.name) && !isSystemFile(f.name)).length;
        const uploadedPdfCount = displayFiles.filter(f => isPdfFile(f.name) && !isSystemFile(f.name) && f.uploadKey).length;
        
        return displayFiles.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', margin: 0, color: '#1f2937' }}>
                文件列表 ({displayFiles.length} 个文件{!showSystemFiles && allFiles.length > displayFiles.length ? `，已隐藏 ${allFiles.length - displayFiles.length} 个系统文件` : ''})
                {pdfCount > 0 && (
                  <span style={{ fontSize: '14px', color: '#6b7280', marginLeft: '8px' }}>
                    | {pdfCount} 个 PDF {uploadedPdfCount > 0 && `(已上传 ${uploadedPdfCount})`}
                  </span>
                )}
              </h3>
              {pdfCount > 0 && currentEnvConfig && (
                <button 
                  className="btn"
                  onClick={handleUploadPdfs}
                  disabled={uploadingCount > 0 || !userId || !parentId}
                  style={{ 
                    fontSize: '14px', 
                    padding: '6px 12px',
                    cursor: (uploadingCount > 0 || !userId || !parentId) ? 'not-allowed' : 'pointer',
                    opacity: (uploadingCount > 0 || !userId || !parentId) ? 0.6 : 1
                  }}
                  title={!userId || !parentId ? '请先填写 User ID 和 Parent ID' : ''}
                >
                  {uploadingCount > 0 ? `上传中... (${uploadingCount})` : '上传并提交到知识库'}
                </button>
              )}
            </div>
            <div className="file-table-container">
              <table className="file-table">
                <thead>
                  <tr>
                    <th>文件名</th>
                    <th>文件大小</th>
                    <th>MD5</th>
                    <th>Upload Key</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {displayFiles.map((file, index) => (
                    <tr key={index} style={{ backgroundColor: isPdfFile(file.name) ? '#fffbeb' : 'transparent' }}>
                      <td className="file-name">
                        {file.name}
                        {isPdfFile(file.name) && (
                          <span style={{ marginLeft: '6px', fontSize: '12px', color: '#dc2626', fontWeight: 'bold' }}>PDF</span>
                        )}
                      </td>
                      <td className="file-size">{formatFileSize(file.size)}</td>
                      <td className="file-md5" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{file.md5}</td>
                      <td style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '11px'
                      }}>
                        {file.uploadKey ? (
                          <div style={{ maxWidth: '300px', wordBreak: 'break-all' }}>
                            {file.uploadKey}
                          </div>
                        ) : isPdfFile(file.name) ? (
                          <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>待上传</span>
                        ) : (
                          <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>-</span>
                        )}
                      </td>
                      <td style={{ 
                        fontSize: '12px',
                        fontWeight: '500',
                        color: file.kbStatus === 'success' ? '#059669' : 
                               file.uploadStatus?.includes('中') ? '#2563eb' : 
                               file.kbStatus === 'failed' ? '#dc2626' : '#9ca3af'
                      }}>
                        {file.uploadStatus || (isPdfFile(file.name) ? '待上传' : '-')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

