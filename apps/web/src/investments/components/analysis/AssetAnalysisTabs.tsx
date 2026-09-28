import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { AssetAnalysis } from "../../types";
import { OverviewSection } from "./OverviewSection";
import { IndicatorsSection } from "./IndicatorsSection";
import { ChecklistSection } from "./ChecklistSection";
import { DividendsSection } from "./DividendsSection";

const TAB_OPTIONS = [
  { value: "overview", label: "Visão Geral" },
  { value: "indicators", label: "Indicadores" },
  { value: "checklist", label: "Checklist" },
  { value: "dividends", label: "Proventos" },
];

interface Props {
  analysis: AssetAnalysis | null | undefined;
  isLoading: boolean;
}

/** The expanded stock/FII analysis — Visão Geral, Indicadores, Checklist, Proventos — sits below
 *  the price chart both the owned-asset and explore detail pages already show, and is deliberately
 *  not rendered at all for crypto (every metric here is an equity-valuation concept: P/L, ROE,
 *  Graham, Bazin don't apply to a coin). */
export function AssetAnalysisTabs({ analysis, isLoading }: Props) {
  const [tab, setTab] = useState("overview");

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onChange={setTab} options={TAB_OPTIONS} className="w-full flex-wrap sm:w-auto" />
      {tab === "overview" && <OverviewSection analysis={analysis} isLoading={isLoading} />}
      {tab === "indicators" && <IndicatorsSection analysis={analysis} isLoading={isLoading} />}
      {tab === "checklist" && <ChecklistSection analysis={analysis} isLoading={isLoading} />}
      {tab === "dividends" && <DividendsSection analysis={analysis} isLoading={isLoading} />}
    </div>
  );
}
