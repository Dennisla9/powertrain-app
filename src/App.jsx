import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <div style={{
              minHeight: '100vh',
              background: '#0c0e11',
              color: '#e7eaee',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'system-ui'
            }}>
              <h1>Aplicación Powertrain</h1>
            </div>
          }
        />
        <Route path="*" element={<div>404 - Página no encontrada</div>} />
      </Routes>
    </Router>
  );
}

export default App;
