import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./app/Layout";
import { ProtectedRoute } from "./app/ProtectedRoute";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Cards from "./pages/Cards";
import Purchases from "./pages/Purchases";
import Installments from "./pages/Installments";
import Subscriptions from "./pages/Subscriptions";
import Financing from "./pages/Financing";
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
import Projects from "./tracking/pages/Projects";
import Incomes from "./tracking/pages/Incomes";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Home />} />

        <Route element={<Layout />}>
          <Route path="/parcelas" element={<Dashboard />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/installments" element={<Installments />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/financing" element={<Financing />} />
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
          <Route path="/horas/projetos" element={<Projects />} />
          <Route path="/horas/entradas" element={<Incomes />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
