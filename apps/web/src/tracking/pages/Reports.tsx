import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { CategoryChart } from "@/components/charts/CategoryChart";
import { formatCurrency } from "@/lib/format";
import { getToken } from "@/lib/api";
import { useTrackingReports } from "../api";
import { ReportPeriod } from "../types";

const PERIOD_OPTIONS = [
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "ano", label: "Ano" },
  { value: "personalizado", label: "Personalizado" },
];

const CATEGORY_COLORS: Record<string, string> = {
  FIXO: "#7C3AED",
  FREELA: "#F59E0B",
  OUTRO: "#3B82F6",
};

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const API_URL = import.meta.env.VITE_API_URL ?? "";

export default function Reports() {
  const [period, setPeriod] = useState<ReportPeriod>("mes");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const { data, isLoading } = useTrackingReports(period, period === "personalizado" ? from : undefined, period === "personalizado" ? to : undefined);

  function exportCsv() {
    fetch(`${API_URL}/tracking/export/sessions.csv`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "sessoes.csv";
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  function exportExcel() {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.revenueByCategory), "Por categoria");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.revenueByClient), "Por cliente");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.revenueByCompany), "Por empresa");
    XLSX.writeFile(wb, `relatorio-horas-${period}.xlsx`);
  }

  function exportPdf() {
    if (!data) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Relatório de Horas</title>
          <style>
            body { font-family: sans-serif; padding: 32px; color: #111; }
            h1 { font-size: 20px; } h2 { font-size: 15px; margin-top: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            td, th { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>Relatório de Horas — ${PERIOD_OPTIONS.find((p) => p.value === period)?.label}</h1>
          <table>
            <tr><td>Total faturado</td><td>${formatCurrency(data.totalRevenue)}</td></tr>
            <tr><td>Horas trabalhadas</td><td>${formatHours(data.hoursWorked)}</td></tr>
            <tr><td>Valor/hora</td><td>${data.averageHourlyRate !== null ? formatCurrency(data.averageHourlyRate) : "—"}</td></tr>
            <tr><td>Projetos realizados</td><td>${data.projectsCount}</td></tr>
            <tr><td>Entradas extras</td><td>${formatCurrency(data.otherIncomeTotal)}</td></tr>
            <tr><td>Dias trabalhados</td><td>${data.daysWorked}</td></tr>
            <tr><td>Maior faturamento diário</td><td>${formatCurrency(data.maxDailyRevenue)}</td></tr>
            <tr><td>Maior carga horária diária</td><td>${formatHours(data.maxDailyHours)}</td></tr>
          </table>
          <h2>Receita por categoria</h2>
          <table>${data.revenueByCategory.map((c) => `<tr><td>${c.label}</td><td>${formatCurrency(c.amount)}</td></tr>`).join("")}</table>
          <h2>Receita por cliente</h2>
          <table>${data.revenueByClient.map((c) => `<tr><td>${c.client}</td><td>${formatCurrency(c.amount)}</td></tr>`).join("")}</table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  const categoryData =
    data?.revenueByCategory.map((c) => ({ name: c.label, color: CATEGORY_COLORS[c.category] ?? "#9CA3AF", total: c.amount, key: c.category })) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted">Filtre por período e exporte seus dados.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!data}>
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={!data}>
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <Tabs value={period} onChange={(v) => setPeriod(v as ReportPeriod)} options={PERIOD_OPTIONS} />

      {period === "personalizado" && (
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <Input label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      )}

      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Total faturado" value={formatCurrency(data.totalRevenue)} tone="success" />
            <StatTile label="Horas trabalhadas" value={formatHours(data.hoursWorked)} />
            <StatTile label="Valor/hora" value={data.averageHourlyRate !== null ? formatCurrency(data.averageHourlyRate) : "—"} />
            <StatTile label="Projetos realizados" value={String(data.projectsCount)} />
            <StatTile label="Entradas extras" value={formatCurrency(data.otherIncomeTotal)} />
            <StatTile label="Dias trabalhados" value={String(data.daysWorked)} />
            <StatTile label="Maior faturamento diário" value={formatCurrency(data.maxDailyRevenue)} />
            <StatTile label="Maior carga horária" value={formatHours(data.maxDailyHours)} />
          </div>

          {categoryData.length > 0 && (
            <Card>
              <CardContent className="flex flex-col gap-3">
                <p className="font-semibold">Receita por categoria</p>
                <CategoryChart data={categoryData} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
