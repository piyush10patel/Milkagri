-- CreateTable
CREATE TABLE "customer_agent_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_agent_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_remittances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "remittance_date" DATE NOT NULL,
    "notes" TEXT,
    "received_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_remittances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_agent_assignments_customer_id_key" ON "customer_agent_assignments"("customer_id");

-- CreateIndex
CREATE INDEX "idx_customer_agent_assignments_agent" ON "customer_agent_assignments"("agent_id");

-- CreateIndex
CREATE INDEX "idx_agent_remittances_agent" ON "agent_remittances"("agent_id");

-- CreateIndex
CREATE INDEX "idx_agent_remittances_date" ON "agent_remittances"("remittance_date");

-- AddForeignKey
ALTER TABLE "customer_agent_assignments" ADD CONSTRAINT "customer_agent_assignments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_agent_assignments" ADD CONSTRAINT "customer_agent_assignments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_remittances" ADD CONSTRAINT "agent_remittances_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_remittances" ADD CONSTRAINT "agent_remittances_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
