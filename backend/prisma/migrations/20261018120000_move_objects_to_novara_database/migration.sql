-- Make novara_database the canonical application schema.
-- Keep public._prisma_migrations in place.
CREATE SCHEMA IF NOT EXISTS novara_database;
ALTER SCHEMA novara_database OWNER TO postgres;
REVOKE ALL ON SCHEMA novara_database FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE, CREATE ON SCHEMA novara_database TO postgres;

-- Moving these objects preserves data, indexes, constraints, and RLS settings.
ALTER TYPE novara."BusinessRole" SET SCHEMA novara_database;
ALTER TYPE novara."CashMovementType" SET SCHEMA novara_database;
ALTER TYPE novara."KitchenItemStatus" SET SCHEMA novara_database;
ALTER TYPE novara."KitchenOrderStatus" SET SCHEMA novara_database;
ALTER TYPE novara."MeasureUnit" SET SCHEMA novara_database;
ALTER TYPE novara."PaymentMethod" SET SCHEMA novara_database;
ALTER TYPE novara."PlatformRole" SET SCHEMA novara_database;
ALTER TYPE novara."PlatformTicketPriority" SET SCHEMA novara_database;
ALTER TYPE novara."PlatformTicketStatus" SET SCHEMA novara_database;
ALTER TYPE novara."PlatformTicketType" SET SCHEMA novara_database;
ALTER TYPE novara."PurchaseStatus" SET SCHEMA novara_database;
ALTER TYPE novara."SalesOrderStatus" SET SCHEMA novara_database;
ALTER TYPE novara."ShiftStatus" SET SCHEMA novara_database;
ALTER TYPE novara."StockMovementType" SET SCHEMA novara_database;
ALTER TYPE novara."StocktakeStatus" SET SCHEMA novara_database;
ALTER TYPE novara."SubscriptionStatus" SET SCHEMA novara_database;
ALTER TYPE novara."TenantStatus" SET SCHEMA novara_database;

ALTER TABLE novara."AuditLog" SET SCHEMA novara_database;
ALTER TABLE novara."Branch" SET SCHEMA novara_database;
ALTER TABLE novara."BranchAssignment" SET SCHEMA novara_database;
ALTER TABLE novara."CashMovement" SET SCHEMA novara_database;
ALTER TABLE novara."Category" SET SCHEMA novara_database;
ALTER TABLE novara."DiningTable" SET SCHEMA novara_database;
ALTER TABLE novara."Expense" SET SCHEMA novara_database;
ALTER TABLE novara."ExpenseCategory" SET SCHEMA novara_database;
ALTER TABLE novara."Ingredient" SET SCHEMA novara_database;
ALTER TABLE novara."Membership" SET SCHEMA novara_database;
ALTER TABLE novara."ModifierGroup" SET SCHEMA novara_database;
ALTER TABLE novara."ModifierOption" SET SCHEMA novara_database;
ALTER TABLE novara."ModifierOptionRecipeItem" SET SCHEMA novara_database;
ALTER TABLE novara."PasswordResetToken" SET SCHEMA novara_database;
ALTER TABLE novara."Payment" SET SCHEMA novara_database;
ALTER TABLE novara."PlatformStaff" SET SCHEMA novara_database;
ALTER TABLE novara."PlatformTicket" SET SCHEMA novara_database;
ALTER TABLE novara."Product" SET SCHEMA novara_database;
ALTER TABLE novara."ProductModifierGroup" SET SCHEMA novara_database;
ALTER TABLE novara."Purchase" SET SCHEMA novara_database;
ALTER TABLE novara."PurchaseItem" SET SCHEMA novara_database;
ALTER TABLE novara."Recipe" SET SCHEMA novara_database;
ALTER TABLE novara."RecipeIngredient" SET SCHEMA novara_database;
ALTER TABLE novara."RefreshToken" SET SCHEMA novara_database;
ALTER TABLE novara."Refund" SET SCHEMA novara_database;
ALTER TABLE novara."RefundItem" SET SCHEMA novara_database;
ALTER TABLE novara."SalesOrder" SET SCHEMA novara_database;
ALTER TABLE novara."SalesOrderItem" SET SCHEMA novara_database;
ALTER TABLE novara."SalesOrderItemModifier" SET SCHEMA novara_database;
ALTER TABLE novara."SalesOrderItemModifierEffect" SET SCHEMA novara_database;
ALTER TABLE novara."Shift" SET SCHEMA novara_database;
ALTER TABLE novara."StockLevel" SET SCHEMA novara_database;
ALTER TABLE novara."StockMovement" SET SCHEMA novara_database;
ALTER TABLE novara."Stocktake" SET SCHEMA novara_database;
ALTER TABLE novara."StocktakeLine" SET SCHEMA novara_database;
ALTER TABLE novara."Subscription" SET SCHEMA novara_database;
ALTER TABLE novara."SubscriptionPlan" SET SCHEMA novara_database;
ALTER TABLE novara."Supplier" SET SCHEMA novara_database;
ALTER TABLE novara."TeamInvitation" SET SCHEMA novara_database;
ALTER TABLE novara."TeamInvitationBranch" SET SCHEMA novara_database;
ALTER TABLE novara."Tenant" SET SCHEMA novara_database;
ALTER TABLE novara."User" SET SCHEMA novara_database;

DROP SCHEMA novara;

REVOKE ALL ON ALL TABLES IN SCHEMA novara_database FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA novara_database FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA novara_database REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA novara_database REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
