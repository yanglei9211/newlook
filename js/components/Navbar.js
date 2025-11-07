// 导航栏组件
function Navbar({ environment, onEnvironmentChange }) {
  return (
    <div className="navbar">
      <div className="navbar-content">
        <div>
          <h1 className="navbar-title">ZIP 文件查看器</h1>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            上传 ZIP 文件，自动提取 PDF 并上传到知识库
          </div>
        </div>
        <div className="env-tabs">
          <button 
            className={`env-tab ${environment === 'test' ? 'active' : ''}`}
            onClick={() => onEnvironmentChange('test')}
          >
            测试环境
          </button>
          <button 
            className={`env-tab ${environment === 'prod' ? 'active' : ''}`}
            onClick={() => onEnvironmentChange('prod')}
          >
            生产环境
          </button>
        </div>
      </div>
    </div>
  );
}

