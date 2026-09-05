-- Cache de tradução das observações, pro extrato em outro idioma.
-- Tabela nova, nada tocado no que já existe.
CREATE TABLE "tracking_note_translations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_note_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tracking_note_translations_userId_sourceHash_lang_key"
    ON "tracking_note_translations"("userId", "sourceHash", "lang");

ALTER TABLE "tracking_note_translations" ADD CONSTRAINT "tracking_note_translations_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
