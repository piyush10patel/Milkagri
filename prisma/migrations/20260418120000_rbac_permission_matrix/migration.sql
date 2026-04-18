-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" "UserRole" NOT NULL,
    "permission" VARCHAR(100) NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_role_permissions_role_permission" ON "role_permissions"("role", "permission");

-- CreateIndex
CREATE INDEX "idx_role_permissions_role" ON "role_permissions"("role");
