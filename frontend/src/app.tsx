// import { h } from 'preact';
import { Router } from 'preact-router';
import { Home } from './pages/home';
import { CreateAgent } from './pages/create-agent';
import { Chat } from './pages/chat';
import { ChatProvider } from './stores/chat.store';
import { MemoryProvider } from './stores/memory.store';
import { ConversationProvider } from './stores/conversation.store';
import './styles/app.css';

export function App() {
  return (
    <div class="app">
      <header class="app-header">
        <div class="header-content">
          <div class="header-brand">
            <h1>Agent Core v0.4</h1>
            <span class="header-subtitle">GenAI Agent Framework</span>
          </div>
          <nav class="header-nav">
            <a href="/" class="nav-link">Dashboard</a>
            <a href="/create-agent" class="nav-link">Create Agent</a>
          </nav>
        </div>
      </header>
      <main class="app-main">
        <ChatProvider>
          <MemoryProvider>
            <ConversationProvider>
              <Router>
                <Home path="/" />
                <CreateAgent path="/create-agent" />
                <Chat path="/chat/:agentId" />
              </Router>
            </ConversationProvider>
          </MemoryProvider>
        </ChatProvider>
      </main>
    </div>
  );
} 