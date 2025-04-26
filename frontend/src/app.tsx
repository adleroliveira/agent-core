// import { h } from 'preact';
import { Router } from 'preact-router';
import { Home } from './pages/home';
import { CreateAgent } from './pages/create-agent';
import { Chat } from './pages/chat';
import { ToolsStudio } from './pages/tools-studio';
import { ChatProvider } from './stores/chat.store';
import { MemoryProvider } from './stores/memory.store';
import { ConversationProvider } from './stores/conversation.store';
import { ToolsStudioProvider } from './stores/tools-studio.store';
import './styles/app.css';

export function App() {
  return (
    <ToolsStudioProvider>
      <div class="app">
        <header class="app-header">
          <div class="header-content">
            <div class="header-brand">
              <h1>Agent Core v0.5.1</h1>
              <span class="header-subtitle">GenAI Agent Framework</span>
            </div>
            <nav class="header-nav">
              <a href="/" class="nav-link">Agents</a>
              <a href="/create-agent" class="nav-link">Create Agent</a>
              <a href="/tools-studio" class="nav-link">Tools Studio</a>
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
                  <ToolsStudio path="/tools-studio" />
                </Router>
              </ConversationProvider>
            </MemoryProvider>
          </ChatProvider>
        </main>
      </div>
    </ToolsStudioProvider>
  );
} 