import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { AssetAnalysis, ChecklistStatus } from "../../types";

const STATUS_STYLE: Record<ChecklistStatus, { icon: typeof CheckCircle2; className: string }> = {
  PASS: { icon: CheckCircle2, className: "text-emerald-500" },
  FAIL: { icon: XCircle, className: "text-red-500" },
  UNKNOWN: { icon: HelpCircle, className: "text-muted" },
};

interface Props {
  analysis: AssetAnalysis | null | undefined;
  isLoading: boolean;
}

export function ChecklistSection({ analysis, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  if (!analysis) {
    return <p className="py-6 text-center text-sm text-muted">Checklist indisponível pra esse ativo no momento.</p>;
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        {analysis.checklist.map((item) => {
          const { icon: Icon, className } = STATUS_STYLE[item.status];
          return (
            <div key={item.id} className="flex items-center gap-3 rounded-xl surface-2 px-4 py-3">
              <Icon className={`h-5 w-5 shrink-0 ${className}`} />
              <p className="text-sm">{item.label}</p>
              {item.status === "UNKNOWN" && <span className="ml-auto shrink-0 text-xs text-muted">Sem dados</span>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
