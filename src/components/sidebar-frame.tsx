"use client";
import { createContext, useContext, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar } from "./navigation";
const SidebarContext = createContext({ visible: true, toggle: () => {} });
export function SidebarFrame({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  return (
    <SidebarContext.Provider
      value={{ visible, toggle: () => setVisible((v) => !v) }}
    >
      <div id="menu-principal">{visible && <Sidebar />}</div>
      <div className={visible ? "lg:pl-64" : ""}>{children}</div>
    </SidebarContext.Provider>
  );
}
export function SidebarToggle() {
  const { visible, toggle } = useContext(SidebarContext);
  return (
    <button
      type="button"
      className="btn-secondary hidden lg:inline-flex"
      onClick={toggle}
      aria-label={visible ? "Ocultar menu principal" : "Exibir menu principal"}
      aria-expanded={visible}
      aria-controls="menu-principal"
    >
      {visible ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
    </button>
  );
}
