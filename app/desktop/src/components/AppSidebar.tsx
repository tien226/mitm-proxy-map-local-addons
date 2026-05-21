import type { AppSection } from "../types";

interface AppSidebarProps {
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
}

export function AppSidebar({ activeSection, onSectionChange }: AppSidebarProps) {
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
    </aside>
  );
}
