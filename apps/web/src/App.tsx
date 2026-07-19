import { Routes, Route } from "react-router-dom";
import { Layout } from "./app/Layout";
import { ProtectedRoute } from "./app/ProtectedRoute";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/Dashboard";
import Cards from "./pages/Cards";
import Purchases from "./pages/Purchases";
import Installments from "./pages/Installments";
import CalendarPage from "./pages/CalendarPage";
import Timeline from "./pages/Timeline";
import Categories from "./pages/Categories";
import Statistics from "./pages/Statistics";
import Trash from "./pages/Trash";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

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
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
