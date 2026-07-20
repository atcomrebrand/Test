import { useState } from "react";
import { ExternalLink, Wallet, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useArticlePreview, useMarketNews, usePortfolioNews } from "../api";
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

function NewsCard({ article, onOpen }: { article: NewsArticle; onOpen: (article: NewsArticle) => void }) {
  return (
    <button
      onClick={() => onOpen(article)}
      className="flex flex-col gap-1.5 rounded-xl surface-2 p-3 text-left transition-colors hover:brightness-95 dark:hover:brightness-110"
    >
      <p className="flex items-start justify-between gap-2 text-sm font-medium leading-snug">
        {article.title}
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
      </p>
      {article.description && <p className="line-clamp-2 text-xs text-muted">{article.description}</p>}
      <p className="text-xs text-muted">
        {article.source ?? "Fonte desconhecida"} · {timeAgo(article.publishedAt)}
      </p>
    </button>
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

/** Rich preview popup instead of an iframe embed — most Brazilian financial news sites (InfoMoney,
 *  Valor, etc.) block framing via X-Frame-Options, so embedding the full site would just show
 *  blank/broken for most sources. This shows the article's own Open Graph title/image/description
 *  and links out for the full read. */
function ArticlePreviewModal({ article, onClose }: { article: NewsArticle | null; onClose: () => void }) {
  const { data: preview, isLoading } = useArticlePreview(article?.link ?? null);
  if (!article) return null;

  const readUrl = preview?.url ?? article.link;

  return (
    <Modal open={!!article} onClose={onClose} title="Notícia" size="lg">
      <div className="flex flex-col gap-3">
        {isLoading ? (
          <>
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : (
          <>
            {preview?.imageUrl ? (
              <img src={preview.imageUrl} alt="" className="h-48 w-full rounded-xl object-cover surface-2" />
            ) : (
              <div className="flex h-32 w-full items-center justify-center rounded-xl surface-2 text-muted">
                <ImageOff className="h-6 w-6" />
              </div>
            )}
            <h3 className="text-lg font-semibold leading-snug">{preview?.title || article.title}</h3>
            <p className="text-xs text-muted">
              {preview?.siteName ?? article.source ?? "Fonte desconhecida"} · {timeAgo(article.publishedAt)}
            </p>
            {(preview?.description || article.description) && (
              <p className="text-sm text-[rgb(var(--text))]">{preview?.description || article.description}</p>
            )}
            {!preview?.title && !preview?.description && (
              <p className="text-xs text-muted">
                Não foi possível carregar uma prévia deste site — use o botão abaixo pra ler a notícia completa.
              </p>
            )}
          </>
        )}

        <a href={readUrl} target="_blank" rel="noopener noreferrer" className="w-full">
          <Button className="w-full">
            <ExternalLink className="h-4 w-4" />
            Ler notícia completa
          </Button>
        </a>
      </div>
    </Modal>
  );
}

export default function News() {
  const { data: marketNews, isLoading: marketLoading } = useMarketNews();
  const { data: portfolioNews, isLoading: portfolioLoading } = usePortfolioNews();
  const [selected, setSelected] = useState<NewsArticle | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Notícias</h1>
        <p className="text-sm text-muted">
          Principais notícias do mercado e novidades sobre os ativos que você tem na carteira, direto dos maiores
          jornais de investimento do Brasil.
        </p>
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
                <NewsCard key={article.link} article={article} onOpen={setSelected} />
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
                <NewsCard key={article.link} article={article} onOpen={setSelected} />
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

      <ArticlePreviewModal article={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
