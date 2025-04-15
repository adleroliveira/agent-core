import { ComponentType, ComponentChildren, VNode } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import '../styles/collapsible-panel.css';

interface MenuTab {
  id: string;
  icon: string | VNode;
  title: string;
  content: ComponentChildren;
}

interface CollapsiblePanelProps {
  isCollapsed: boolean;
  onToggle: () => void;
  menuTabs?: MenuTab[];
  activeTabId?: string;
  onTabClick?: (tabId: string) => void;
  children?: ComponentChildren;
}

export const CollapsiblePanel: ComponentType<CollapsiblePanelProps> = ({
  isCollapsed,
  onToggle,
  menuTabs = [],
  activeTabId = '',
  onTabClick = () => { },
  children
}) => {
  const [contentVisible, setContentVisible] = useState(!isCollapsed);
  const prevCollapsed = useRef(isCollapsed);

  useEffect(() => {
    if (!isCollapsed) {
      // Opening: wait for width transition, then show content
      const timeout = setTimeout(() => setContentVisible(true), 300);
      return () => clearTimeout(timeout);
    } else {
      // Closing: hide content immediately
      setContentVisible(false);
    }
    prevCollapsed.current = isCollapsed;
  }, [isCollapsed]);

  const activeTab = menuTabs.find(tab => tab.id === activeTabId);

  const handleTabClick = (tabId: string) => {
    if (isCollapsed) {
      onToggle();
    }
    onTabClick(tabId);
  };

  return (
    <div class={`collapsible-panel ${isCollapsed ? 'collapsed' : ''}`}
      style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>
      {/* Panel content on the left, always rendered for smooth animation */}
      <div class={`panel-content${contentVisible ? ' content-visible' : ''}`} style={{ flex: 1 }}>
        <div class="panel-header">
          <h2>{activeTab?.title || ''}</h2>
        </div>
        {activeTab ? activeTab.content : children}
      </div>
      {/* Menu tabs (icons) on the right, always visible */}
      <div class="menu-tabs" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', height: '100%', borderLeft: '1px solid #e0e0e0', minWidth: '60px', display: 'flex' }}>
        <div
          class="menu-tab"
          onClick={onToggle}
          style={{ margin: '8px 0' }}
        >
          <span class="icon">{isCollapsed ? '→' : '←'}</span>
        </div>
        {menuTabs.map(tab => (
          <div
            key={tab.id}
            class={`menu-tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
            style={{ margin: '8px 0' }}
          >
            <span class="icon">{typeof tab.icon === 'string' ? tab.icon : tab.icon}</span>
          </div>
        ))}
      </div>
    </div>
  );
}; 