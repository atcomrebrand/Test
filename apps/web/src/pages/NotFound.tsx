import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <p className="text-5xl font-bold text-accent-500">404</p>
      <p className="text-muted">Página não encontrada.</p>
      <Link to="/">
        <Button variant="secondary">Voltar ao início</Button>
      </Link>
    </div>
  );
}
