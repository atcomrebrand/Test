-- CreateTable
CREATE TABLE "gym_exercise_photos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_exercise_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gym_exercise_photos_userId_exerciseId_key" ON "gym_exercise_photos"("userId", "exerciseId");

-- AddForeignKey
ALTER TABLE "gym_exercise_photos" ADD CONSTRAINT "gym_exercise_photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_exercise_photos" ADD CONSTRAINT "gym_exercise_photos_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "gym_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
