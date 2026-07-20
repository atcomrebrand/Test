import { Routes, Route } from "react-router-dom";
import { Layout } from "./app/Layout";
import { ProtectedRoute } from "./app/ProtectedRoute";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
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
import FixedIncomePage from "./investments/pages/FixedIncomePage";
import History from "./investments/pages/History";
import News from "./investments/pages/News";
import Dividends from "./investments/pages/Dividends";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
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
          <Route path="/investimentos/renda-fixa" element={<FixedIncomePage />} />
          <Route path="/investimentos/historico" element={<History />} />
          <Route path="/investimentos/noticias" element={<News />} />
          <Route path="/investimentos/proventos" element={<Dividends />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
