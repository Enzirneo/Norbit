-- CreateTable
CREATE TABLE "email_changes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "newEmail" CITEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_changes_tokenHash_key" ON "email_changes"("tokenHash");

-- CreateIndex
CREATE INDEX "email_changes_userId_idx" ON "email_changes"("userId");

-- CreateIndex
CREATE INDEX "email_changes_expiresAt_idx" ON "email_changes"("expiresAt");

-- AddForeignKey
ALTER TABLE "email_changes" ADD CONSTRAINT "email_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
