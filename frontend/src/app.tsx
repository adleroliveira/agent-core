// import { h } from 'preact';
import { Router } from 'preact-router';
import { Home } from './pages/home';
import { CreateAgent } from './pages/create-agent';
import { Chat } from './pages/chat';
import './styles/app.css';

export function App() {
  return (
    <div class="app">
      <header class="app-header">
        <div class="header-content">
          <div class="header-brand">
            <h1>Agent Core</h1>
            <span class="header-subtitle">AI Agent Management</span>
          </div>
          <nav class="header-nav">
            <a href="/" class="nav-link">Dashboard</a>
            <a href="/create-agent" class="nav-link">Create Agent</a>
          </nav>
        </div>
      </header>
      <main class="app-main">
        <Router>
          <Home path="/" />
          <CreateAgent path="/create-agent" />
          <Chat path="/chat/:agentId" />
        </Router>
      </main>
    </div>
  );
} 