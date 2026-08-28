import { Routes, Route, Navigate } from "react-router-dom";
import { usePrivacyStore } from "@/store/privacy";
import { Layout } from "./app/Layout";
import { ProtectedRoute } from "./app/ProtectedRoute";
import { CrmLayout } from "./crm/CrmLayout";
import { GymLayout } from "./gym/GymLayout";
import GymInicio from "./gym/pages/Inicio";
import GymTreinos from "./gym/pages/Treinos";
import GymTreinoForm from "./gym/pages/TreinoForm";
import GymExercicios from "./gym/pages/Exercicios";
import GymExercicioDetalhe from "./gym/pages/ExercicioDetalhe";
import GymExecutar from "./gym/pages/Executar";
import GymResumo from "./gym/pages/Resumo";
import GymProgresso from "./gym/pages/Progresso";
import GymHistorico from "./gym/pages/Historico";
import GymSessaoDetalhe from "./gym/pages/SessaoDetalhe";
import GymPerfil from "./gym/pages/Perfil";
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
import { Carteiras, CarteiraDetalhe } from "./investments/pages/Carteiras";
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
  // O assinante que faz o modo privacidade valer na tela inteira.
  //
  // `formatCurrency` lê o estado de fora do React (é função pura, chamada de 399 lugares), então
  // nada re-renderizaria sozinho ao ligar o olho: os valores ficariam na tela até algo mais
  // acontecer. Assinando aqui em cima, ligar o modo re-renderiza a árvore toda e cada
  // `formatCurrency` roda de novo. Re-render, não remontagem — mês selecionado, rolagem e modal
  // aberto continuam onde estavam.
  usePrivacyStore((s) => s.hidden);

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
          <Route path="/investimentos/carteiras" element={<Carteiras />} />
          <Route path="/investimentos/carteiras/:id" element={<CarteiraDetalhe />} />
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


        <Route element={<GymLayout />}>
          <Route path="/academia" element={<GymInicio />} />
          <Route path="/academia/treinos" element={<GymTreinos />} />
          <Route path="/academia/treinos/novo" element={<GymTreinoForm />} />
          <Route path="/academia/treinos/:id" element={<GymTreinoForm />} />
          <Route path="/academia/exercicios" element={<GymExercicios />} />
          <Route path="/academia/exercicios/:id" element={<GymExercicioDetalhe />} />
          <Route path="/academia/executar" element={<GymExecutar />} />
          <Route path="/academia/resumo/:clientId" element={<GymResumo />} />
          <Route path="/academia/progresso" element={<GymProgresso />} />
          <Route path="/academia/historico" element={<GymHistorico />} />
          <Route path="/academia/historico/:id" element={<GymSessaoDetalhe />} />
          <Route path="/academia/perfil" element={<GymPerfil />} />
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
