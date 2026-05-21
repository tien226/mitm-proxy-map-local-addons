import type { DomainGroup } from "../utils/domains";
import type { AppSection } from "../types";

interface AppSidebarProps {
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
  domains: DomainGroup[];
  selectedHost: string | null;
  onSelectHost: (host: string | null) => void;
  totalFlowCount: number;
}

export function AppSidebar({
  activeSection,
  onSectionChange,
  domains,
  selectedHost,
  onSelectHost,
  totalFlowCount,
}: AppSidebarProps) {
  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav">
        <button
          type="button"
          className={`sidebar-nav-item ${activeSection === "traffic" ? "active" : ""}`}
          onClick={() => onSectionChange("traffic")}
        >
          Traffic
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${activeSection === "map-local" ? "active" : ""}`}
          onClick={() => onSectionChange("map-local")}
        >
          Map Local
        </button>
        <button
          type="button"
          className={`sidebar-nav-item ${activeSection === "setup" ? "active" : ""}`}
          onClick={() => onSectionChange("setup")}
        >
          Setup
        </button>
      </nav>
      {activeSection === "traffic" && (
        <div className="sidebar-domains">
          <div className="sidebar-section-title">All</div>
          <button
            type="button"
            className={`sidebar-domain-item ${selectedHost === null ? "active" : ""}`}
            onClick={() => onSelectHost(null)}
          >
            <span className="sidebar-domain-icon">◉</span>
            <span className="sidebar-domain-label">All requests</span>
            <span className="sidebar-domain-count">{totalFlowCount}</span>
          </button>
          <div className="sidebar-section-title">Domains</div>
          <div className="sidebar-domain-list">
            {domains.map((domain) => (
              <button
                key={domain.host}
                type="button"
                className={`sidebar-domain-item ${selectedHost === domain.host ? "active" : ""}`}
                onClick={() => onSelectHost(domain.host)}
              >
                <span className="sidebar-domain-icon">◉</span>
                <span className="sidebar-domain-label">{domain.host}</span>
                <span className="sidebar-domain-count">{domain.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
