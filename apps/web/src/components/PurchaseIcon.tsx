import { matchServiceIcon } from "@/lib/serviceIcons";
import { Purchase } from "@/types";

interface Props {
  purchase: Pick<Purchase, "kind" | "name" | "category">;
  size?: "sm" | "md";
}

/** Recognized-brand icon for a recurring subscription, falling back to the category-color dot used everywhere else. */
export function PurchaseIcon({ purchase, size = "sm" }: Props) {
  const match = purchase.kind === "RECURRING" ? matchServiceIcon(purchase.name) : null;

  if (match) {
    const { Icon, color } = match;
    const dim = size === "sm" ? "h-6 w-6" : "h-10 w-10";
    const iconDim = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
    return (
      <span
        className={`flex ${dim} shrink-0 items-center justify-center rounded-full`}
        style={{ backgroundColor: `${color}1a` }}
      >
        <Icon className={iconDim} style={{ color }} />
      </span>
    );
  }

  return (
    <span
      className="h-3 w-3 shrink-0 rounded-full"
      style={{ backgroundColor: purchase.category?.color ?? "#999" }}
    />
  );
}
