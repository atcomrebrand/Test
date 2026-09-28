-- CreateTable
CREATE TABLE "assistant_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_memories_userId_idx" ON "assistant_memories"("userId");

-- AddForeignKey
ALTER TABLE "assistant_memories" ADD CONSTRAINT "assistant_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
