import React from 'react';
import {
  Home,
  Mail,
  Upload,
  ShoppingBag,
  BarChart3,
  Users,
  ShieldAlert,
  Sparkles,
  Radio,
  KeyRound,
} from 'lucide-react';

export type NavRoute =
  | 'home'
  | 'emails-stock'
  | 'emails-import'
  | 'emails-purchase'
  | 'emails-metrics'
  | 'accounts'
  | 'characters'
  | 'creation'
  | 'connection'
  | 'access';

interface NavItem {
  id: NavRoute;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAVIGATION_GROUPS: NavGroup[] = [
  {
    group: 'VISÃO GERAL',
    items: [{ id: 'home', label: 'Início', icon: Home }],
  },
  {
    group: 'EMAILS',
    items: [
      { id: 'emails-stock', label: 'Estoque', icon: Mail },
      { id: 'emails-import', label: 'Importar e cadastrar', icon: Upload },
      { id: 'emails-purchase', label: 'Compras', icon: ShoppingBag },
      { id: 'emails-metrics', label: 'Indicadores', icon: BarChart3 },
    ],
  },
  {
    group: 'CONTAS E PERSONAGENS',
    items: [
      { id: 'accounts', label: 'Contas Ankama', icon: Users },
      { id: 'characters', label: 'Personagens', icon: ShieldAlert },
      { id: 'creation', label: 'Criação', icon: Sparkles },
    ],
  },
  {
    group: 'APLICATIVO',
    items: [
      { id: 'connection', label: 'Conexão', icon: Radio },
      { id: 'access', label: 'Acesso', icon: KeyRound },
    ],
  },
];

interface SidebarProps {
  currentRoute: NavRoute;
  onNavigate: (route: NavRoute) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentRoute, onNavigate }) => {
  return (
    <aside
      className="glass w-[264px] max-lg:w-[72px] max-md:hidden h-[calc(100vh-32px-24px)] sticky top-[44px] ml-[12px] my-[12px] flex flex-col justify-between p-3.5 z-40 transition-all duration-200"
      aria-label="Navegação Principal"
    >
      {/* Topo da Sidebar: Logotipo e Marca */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 px-2 py-1 select-none">
          <div
            className="h-[38px] aspect-[257/440] mark text-foam-50 shrink-0"
            aria-hidden="true"
          />
          <div className="flex flex-col max-lg:hidden">
            <span
              className="font-medium text-foam-50 tracking-[0.14em] text-[18px] leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              RYUJIN
            </span>
            <span className="text-[11px] text-foam-500 tracking-[0.08em] font-medium">
              DOFUS TOUCH
            </span>
          </div>
        </div>

        {/* Grupos de navegação */}
        <nav className="flex flex-col gap-4 mt-1 overflow-y-auto pr-1">
          {NAVIGATION_GROUPS.map((grp) => (
            <div key={grp.group} className="flex flex-col gap-1">
              <span className="px-2.5 text-[12px] font-semibold text-foam-300 tracking-[0.05em] uppercase select-none max-lg:hidden">
                {grp.group}
              </span>
              <div className="flex flex-col gap-1">
                {grp.items.map((item) => {
                  const isActive = currentRoute === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      title={item.label}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      className={`h-[36px] w-full flex items-center gap-2.5 px-3 rounded-[var(--radius-ctl)] text-[14px] font-medium transition-all duration-150 select-none ${
                        isActive
                          ? 'bg-foam-50 text-[#0B0D12] shadow-md font-semibold cursor-default'
                          : 'text-foam-300 hover:text-foam-50 hover:bg-white/5 active:bg-white/10'
                      }`}
                    >
                      <Icon
                        size={18}
                        strokeWidth={1.5}
                        className={`shrink-0 ${isActive ? 'text-[#0B0D12]' : 'text-current'}`}
                      />
                      <span className="truncate max-lg:hidden">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Rodapé da Sidebar: Status de Conexão */}
      <div className="pt-3 border-t border-white/10 flex items-center gap-2.5 px-2 select-none">
        <span
          className="w-2.5 h-2.5 rounded-full bg-ok animate-pulse-green shrink-0"
          aria-hidden="true"
        />
        <div className="flex flex-col truncate max-lg:hidden">
          <span className="text-[13px] font-medium text-foam-50 leading-tight">
            API conectada
          </span>
          <span className="text-[11px] text-foam-500">Operações ativas</span>
        </div>
      </div>
    </aside>
  );
};

