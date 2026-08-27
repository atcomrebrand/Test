import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./app/Layout";
import { ProtectedRoute } from "./app/ProtectedRoute";
import { CrmLayout } from "./crm/CrmLayout";
import CrmDashboard from "./crm/pages/Dashboard";
import CrmVencimentos from "./crm/pages/Vencimentos";
import CrmPainel from "./crm/pages/Painel";
import CrmClientes from "./crm/pages/Clientes";
import CrmClienteDetalhe from "./crm/pages/ClienteDetalhe";
import CrmRevendedores from "./crm/pages/Revendedores";
import CrmRevendedorDetalhe from "./crm/pages/RevendedorDetalhe";
import CrmLeads from "./crm/pages/Leads";
import CrmFinanceiro from "./crm/pages/Financeiro";
import CrmRetencao from "./crm/pages/Retencao";
import CrmRelatorios from "./crm/pages/Relatorios";
import CrmComunicacao from "./crm/pages/Comunicacao";
import CrmConfiguracoes from "./crm/pages/Configuracoes";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Home from "./pages/Home";
import GeneralSettings from "./pages/GeneralSettings";
import Dashboard from "./pages/Dashboard";
import Cards from "./pages/Cards";
import Purchases from "./pages/Purchases";
import Installments from "./pages/Installments";
import Subscriptions from "./pages/Subscriptions";
import CalendarPage from "./pages/CalendarPage";
import Timeline from "./pages/Timeline";
import Categories from "./pages/Categories";
import Statistics from "./pages/Statistics";
import Trash from "./pages/Trash";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import { InvestmentsLayout } from "./investments/InvestmentsLayout";
import InvestmentsDashboard from "./investments/pages/InvestmentsDashboard";
import Explore from "./investments/pages/Explore";
import MarketAssetDetail from "./investments/pages/MarketAssetDetail";
import Portfolio from "./investments/pages/Portfolio";
import Simular from "./investments/pages/Simular";
import AssetDetail from "./investments/pages/AssetDetail";
import History from "./investments/pages/History";
import News from "./investments/pages/News";
import Dividends from "./investments/pages/Dividends";
import ImportB3 from "./investments/pages/ImportB3";
import Lancamentos from "./investments/pages/Lancamentos";
import { TrackingLayout } from "./tracking/TrackingLayout";
import FocusMode from "./tracking/pages/FocusMode";
import Jobs from "./tracking/pages/Jobs";
import TrackingDashboard from "./tracking/pages/Dashboard";
import Sessions from "./tracking/pages/Sessions";
import Incomes from "./tracking/pages/Incomes";
import CalendarView from "./tracking/pages/CalendarView";
import Reports from "./tracking/pages/Reports";
import Stats from "./tracking/pages/Stats";
import TrackingHistory from "./tracking/pages/HistoryPage";
import TrackingSearch from "./tracking/pages/Search";
import { FinancingsLayout } from "./financings/FinancingsLayout";
import FinanciamentosVisaoGeral from "./financings/pages/VisaoGeral";
import FinanciamentosBens from "./financings/pages/Bens";
import FinanciamentosParcelas from "./financings/pages/Parcelas";
import { MarketLayout } from "./market/MarketLayout";
import MercadoResumo from "./market/pages/Resumo";
import MercadoImportar from "./market/pages/Importar";
import MercadoCompras from "./market/pages/Compras";
import MercadoCompraDetalhe from "./market/pages/CompraDetalhe";
import MercadoProdutos from "./market/pages/Produtos";
import MercadoProdutoDetalhe from "./market/pages/ProdutoDetalhe";
import { HouseholdLayout } from "./household/HouseholdLayout";
import HouseholdDashboard from "./household/pages/Dashboard";
import HouseholdContas from "./household/pages/Contas";
import HouseholdCartoes from "./household/pages/Cartoes";
import HouseholdEntradas from "./household/pages/Entradas";
import HouseholdConfiguracoes from "./household/pages/Configuracoes";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Home />} />
        <Route path="/configuracoes" element={<GeneralSettings />} />

        <Route element={<Layout />}>
          <Route path="/parcelas" element={<Dashboard />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/installments" element={<Installments />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/financing" element={<Navigate to="/financiamentos" replace />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route element={<InvestmentsLayout />}>
          <Route path="/investimentos" element={<InvestmentsDashboard />} />
          <Route path="/investimentos/explorar" element={<Explore />} />
          <Route path="/investimentos/explorar/:class/:ticker" element={<MarketAssetDetail />} />
          <Route path="/investimentos/carteira" element={<Portfolio />} />
          <Route path="/investimentos/simular" element={<Simular />} />
          <Route path="/investimentos/carteira/:id" element={<AssetDetail />} />
          <Route path="/investimentos/renda-fixa" element={<Navigate to="/investimentos/carteira" replace />} />
          <Route path="/investimentos/historico" element={<History />} />
          <Route path="/investimentos/noticias" element={<News />} />
          <Route path="/investimentos/proventos" element={<Dividends />} />
          <Route path="/investimentos/importar" element={<ImportB3 />} />
          <Route path="/investimentos/lancamentos" element={<Lancamentos />} />
        </Route>

        <Route element={<TrackingLayout />}>
          <Route path="/horas" element={<FocusMode />} />
          <Route path="/horas/dashboard" element={<TrackingDashboard />} />
          <Route path="/horas/trabalhos" element={<Jobs />} />
          <Route path="/horas/sessoes" element={<Sessions />} />
          <Route path="/horas/entradas" element={<Incomes />} />
          <Route path="/horas/calendario" element={<CalendarView />} />
          <Route path="/horas/relatorios" element={<Reports />} />
          <Route path="/horas/estatisticas" element={<Stats />} />
          <Route path="/horas/historico" element={<TrackingHistory />} />
          <Route path="/horas/busca" element={<TrackingSearch />} />
        </Route>

        <Route element={<FinancingsLayout />}>
          <Route path="/financiamentos" element={<FinanciamentosVisaoGeral />} />
          <Route path="/financiamentos/bens" element={<FinanciamentosBens />} />
          <Route path="/financiamentos/parcelas" element={<FinanciamentosParcelas />} />
        </Route>


        <Route element={<CrmLayout />}>
          <Route path="/crm" element={<CrmDashboard />} />
          <Route path="/crm/vencimentos" element={<CrmVencimentos />} />
          <Route path="/crm/clientes" element={<CrmClientes />} />
          <Route path="/crm/clientes/:id" element={<CrmClienteDetalhe />} />
          <Route path="/crm/revendedores" element={<CrmRevendedores />} />
          <Route path="/crm/revendedores/:id" element={<CrmRevendedorDetalhe />} />
          <Route path="/crm/leads" element={<CrmLeads />} />
          <Route path="/crm/painel" element={<CrmPainel />} />
          <Route path="/crm/financeiro" element={<CrmFinanceiro />} />
          <Route path="/crm/retencao" element={<CrmRetencao />} />
          <Route path="/crm/relatorios" element={<CrmRelatorios />} />
          <Route path="/crm/comunicacao" element={<CrmComunicacao />} />
          <Route path="/crm/configuracoes" element={<CrmConfiguracoes />} />
        </Route>

        <Route element={<MarketLayout />}>
          <Route path="/mercado" element={<MercadoResumo />} />
          <Route path="/mercado/importar" element={<MercadoImportar />} />
          <Route path="/mercado/compras" element={<MercadoCompras />} />
          <Route path="/mercado/compras/:id" element={<MercadoCompraDetalhe />} />
          <Route path="/mercado/produtos" element={<MercadoProdutos />} />
          <Route path="/mercado/produtos/:id" element={<MercadoProdutoDetalhe />} />
        </Route>

        <Route element={<HouseholdLayout />}>
          <Route path="/casa" element={<HouseholdDashboard />} />
          <Route path="/casa/contas" element={<HouseholdContas />} />
          <Route path="/casa/cartoes" element={<HouseholdCartoes />} />
          <Route path="/casa/entradas" element={<HouseholdEntradas />} />
          <Route path="/casa/configuracoes" element={<HouseholdConfiguracoes />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
