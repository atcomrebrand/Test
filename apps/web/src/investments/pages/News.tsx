import { ExternalLink, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMarketNews, usePortfolioNews } from "../api";
import { NewsArticle } from "../types";

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "agora mesmo";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-1.5 rounded-xl surface-2 p-3 transition-colors hover:brightness-95 dark:hover:brightness-110"
    >
      <p className="flex items-start justify-between gap-2 text-sm font-medium leading-snug">
        {article.title}
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
      </p>
      <p className="text-xs text-muted">
        {article.source ?? "Fonte desconhecida"} · {timeAgo(article.publishedAt)}
      </p>
    </a>
  );
}

function NewsListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

export default function News() {
  const { data: marketNews, isLoading: marketLoading } = useMarketNews();
  const { data: portfolioNews, isLoading: portfolioLoading } = usePortfolioNews();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Notícias</h1>
        <p className="text-sm text-muted">Principais notícias do mercado e novidades sobre os ativos que você tem na carteira.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Principais notícias do mercado</CardTitle>
        </CardHeader>
        <CardContent>
          {marketLoading ? (
            <NewsListSkeleton />
          ) : marketNews && marketNews.length > 0 ? (
            <div className="flex flex-col gap-2">
              {marketNews.map((article) => (
                <NewsCard key={article.link} article={article} />
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted">Nenhuma notícia disponível no momento — tente novamente mais tarde.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notícias dos seus ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {portfolioLoading ? (
            <NewsListSkeleton />
          ) : portfolioNews && portfolioNews.length > 0 ? (
            <div className="flex flex-col gap-2">
              {portfolioNews.map((article) => (
                <NewsCard key={article.link} article={article} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Wallet className="h-7 w-7" />}
              title="Sem notícias dos seus ativos"
              description="Cadastre ações, FIIs ou criptomoedas na sua carteira pra acompanhar notícias específicas deles aqui."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
