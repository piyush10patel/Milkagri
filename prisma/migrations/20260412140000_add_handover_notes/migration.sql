-- CreateTable
CREATE TABLE "handover_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "note_date" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handover_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_handover_notes_date" ON "handover_notes"("note_date");

-- AddForeignKey
ALTER TABLE "handover_notes" ADD CONSTRAINT "handover_notes_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
