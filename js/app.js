// 主应用组件
function App() {
  const { useState } = React;
  const [environment, setEnvironment] = useState('test'); // 默认测试环境

  return (
    <>
      <Navbar 
        environment={environment} 
        onEnvironmentChange={setEnvironment} 
      />
      <div className="container">
        <ZipViewer environment={environment} />
      </div>
    </>
  );
}

// 初始化应用
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

