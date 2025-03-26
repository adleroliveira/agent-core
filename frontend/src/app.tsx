// import { h } from 'preact';
import { Router } from 'preact-router';
import { Home } from './pages/home';

export function App() {
  return (
    <div class="app">
      <header class="app-header">
        <h1>Agent Core Dashboard</h1>
      </header>
      <main class="app-main">
        <Router>
          <Home path="/" />
        </Router>
      </main>
    </div>
  );
} 