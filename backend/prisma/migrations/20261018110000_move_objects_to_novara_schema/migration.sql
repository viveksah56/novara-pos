-- Rename the canonical application schema while preserving data and Prisma history.
-- public._prisma_migrations remains in public for Prisma Migrate compatibility.
CREATE SCHEMA IF NOT EXISTS novara;
ALTER SCHEMA novara OWNER TO postgres;
REVOKE ALL ON SCHEMA novara FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE, CREATE ON SCHEMA novara TO postgres;

-- Moving these objects preserves rows, indexes, constraints, and RLS configuration.
ALTER TYPE novara_database."BusinessRole" SET SCHEMA novara;
ALTER TYPE novara_database."CashMovementType" SET SCHEMA novara;
ALTER TYPE novara_database."KitchenItemStatus" SET SCHEMA novara;
ALTER TYPE novara_database."KitchenOrderStatus" SET SCHEMA novara;
ALTER TYPE novara_database."MeasureUnit" SET SCHEMA novara;
ALTER TYPE novara_database."PaymentMethod" SET SCHEMA novara;
ALTER TYPE novara_database."PlatformRole" SET SCHEMA novara;
ALTER TYPE novara_database."PlatformTicketPriority" SET SCHEMA novara;
ALTER TYPE novara_database."PlatformTicketStatus" SET SCHEMA novara;
ALTER TYPE novara_database."PlatformTicketType" SET SCHEMA novara;
ALTER TYPE novara_database."PurchaseStatus" SET SCHEMA novara;
ALTER TYPE novara_database."SalesOrderStatus" SET SCHEMA novara;
ALTER TYPE novara_database."ShiftStatus" SET SCHEMA novara;
ALTER TYPE novara_database."StockMovementType" SET SCHEMA novara;
ALTER TYPE novara_database."StocktakeStatus" SET SCHEMA novara;
ALTER TYPE novara_database."SubscriptionStatus" SET SCHEMA novara;
ALTER TYPE novara_database."TenantStatus" SET SCHEMA novara;

ALTER TABLE novara_database."AuditLog" SET SCHEMA novara;
ALTER TABLE novara_database."Branch" SET SCHEMA novara;
ALTER TABLE novara_database."BranchAssignment" SET SCHEMA novara;
ALTER TABLE novara_database."CashMovement" SET SCHEMA novara;
ALTER TABLE novara_database."Category" SET SCHEMA novara;
ALTER TABLE novara_database."DiningTable" SET SCHEMA novara;
ALTER TABLE novara_database."Expense" SET SCHEMA novara;
ALTER TABLE novara_database."ExpenseCategory" SET SCHEMA novara;
ALTER TABLE novara_database."Ingredient" SET SCHEMA novara;
ALTER TABLE novara_database."Membership" SET SCHEMA novara;
ALTER TABLE novara_database."ModifierGroup" SET SCHEMA novara;
ALTER TABLE novara_database."ModifierOption" SET SCHEMA novara;
ALTER TABLE novara_database."ModifierOptionRecipeItem" SET SCHEMA novara;
ALTER TABLE novara_database."PasswordResetToken" SET SCHEMA novara;
ALTER TABLE novara_database."Payment" SET SCHEMA novara;
ALTER TABLE novara_database."PlatformStaff" SET SCHEMA novara;
ALTER TABLE novara_database."PlatformTicket" SET SCHEMA novara;
ALTER TABLE novara_database."Product" SET SCHEMA novara;
ALTER TABLE novara_database."ProductModifierGroup" SET SCHEMA novara;
ALTER TABLE novara_database."Purchase" SET SCHEMA novara;
ALTER TABLE novara_database."PurchaseItem" SET SCHEMA novara;
ALTER TABLE novara_database."Recipe" SET SCHEMA novara;
ALTER TABLE novara_database."RecipeIngredient" SET SCHEMA novara;
ALTER TABLE novara_database."RefreshToken" SET SCHEMA novara;
ALTER TABLE novara_database."Refund" SET SCHEMA novara;
ALTER TABLE novara_database."RefundItem" SET SCHEMA novara;
ALTER TABLE novara_database."SalesOrder" SET SCHEMA novara;
ALTER TABLE novara_database."SalesOrderItem" SET SCHEMA novara;
ALTER TABLE novara_database."SalesOrderItemModifier" SET SCHEMA novara;
ALTER TABLE novara_database."SalesOrderItemModifierEffect" SET SCHEMA novara;
ALTER TABLE novara_database."Shift" SET SCHEMA novara;
ALTER TABLE novara_database."StockLevel" SET SCHEMA novara;
ALTER TABLE novara_database."StockMovement" SET SCHEMA novara;
ALTER TABLE novara_database."Stocktake" SET SCHEMA novara;
ALTER TABLE novara_database."StocktakeLine" SET SCHEMA novara;
ALTER TABLE novara_database."Subscription" SET SCHEMA novara;
ALTER TABLE novara_database."SubscriptionPlan" SET SCHEMA novara;
ALTER TABLE novara_database."Supplier" SET SCHEMA novara;
ALTER TABLE novara_database."TeamInvitation" SET SCHEMA novara;
ALTER TABLE novara_database."TeamInvitationBranch" SET SCHEMA novara;
ALTER TABLE novara_database."Tenant" SET SCHEMA novara;
ALTER TABLE novara_database."User" SET SCHEMA novara;

DROP SCHEMA novara_database;

REVOKE ALL ON ALL TABLES IN SCHEMA novara FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA novara FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA novara REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA novara REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
