import { ComponentType, ComponentChildren, VNode } from 'preact';
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
  const activeTab = menuTabs.find(tab => tab.id === activeTabId);

  const handleTabClick = (tabId: string) => {
    if (isCollapsed) {
      onToggle();
    }
    onTabClick(tabId);
  };

  return (
    <div class={`collapsible-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div class="menu-tabs">
        {menuTabs.map(tab => (
          <div
            key={tab.id}
            class={`menu-tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            <span class="icon">{typeof tab.icon === 'string' ? tab.icon : tab.icon}</span>
          </div>
        ))}
      </div>
      {!isCollapsed && (
        <div class="panel-content">
          <div class="panel-header">
            <h2>{activeTab?.title || ''}</h2>
            <button
              class="close-button"
              onClick={onToggle}
            >
              <span class="icon">×</span>
            </button>
          </div>
          {activeTab ? activeTab.content : children}
        </div>
      )}
    </div>
  );
}; 