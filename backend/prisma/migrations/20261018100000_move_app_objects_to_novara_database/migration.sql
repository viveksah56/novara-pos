-- Move the application data model into its dedicated PostgreSQL schema.
-- Keep public._prisma_migrations in place so Prisma Migrate history remains intact.
CREATE SCHEMA IF NOT EXISTS novara_database;
ALTER SCHEMA novara_database OWNER TO postgres;
REVOKE ALL ON SCHEMA novara_database FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE, CREATE ON SCHEMA novara_database TO postgres;

-- Moving enum types and tables preserves their values, rows, indexes, constraints, and RLS settings.
ALTER TYPE public."BusinessRole" SET SCHEMA novara_database;
ALTER TYPE public."CashMovementType" SET SCHEMA novara_database;
ALTER TYPE public."KitchenItemStatus" SET SCHEMA novara_database;
ALTER TYPE public."KitchenOrderStatus" SET SCHEMA novara_database;
ALTER TYPE public."MeasureUnit" SET SCHEMA novara_database;
ALTER TYPE public."PaymentMethod" SET SCHEMA novara_database;
ALTER TYPE public."PlatformRole" SET SCHEMA novara_database;
ALTER TYPE public."PlatformTicketPriority" SET SCHEMA novara_database;
ALTER TYPE public."PlatformTicketStatus" SET SCHEMA novara_database;
ALTER TYPE public."PlatformTicketType" SET SCHEMA novara_database;
ALTER TYPE public."PurchaseStatus" SET SCHEMA novara_database;
ALTER TYPE public."SalesOrderStatus" SET SCHEMA novara_database;
ALTER TYPE public."ShiftStatus" SET SCHEMA novara_database;
ALTER TYPE public."StockMovementType" SET SCHEMA novara_database;
ALTER TYPE public."StocktakeStatus" SET SCHEMA novara_database;
ALTER TYPE public."SubscriptionStatus" SET SCHEMA novara_database;
ALTER TYPE public."TenantStatus" SET SCHEMA novara_database;

ALTER TABLE public."AuditLog" SET SCHEMA novara_database;
ALTER TABLE public."Branch" SET SCHEMA novara_database;
ALTER TABLE public."BranchAssignment" SET SCHEMA novara_database;
ALTER TABLE public."CashMovement" SET SCHEMA novara_database;
ALTER TABLE public."Category" SET SCHEMA novara_database;
ALTER TABLE public."DiningTable" SET SCHEMA novara_database;
ALTER TABLE public."Expense" SET SCHEMA novara_database;
ALTER TABLE public."ExpenseCategory" SET SCHEMA novara_database;
ALTER TABLE public."Ingredient" SET SCHEMA novara_database;
ALTER TABLE public."Membership" SET SCHEMA novara_database;
ALTER TABLE public."ModifierGroup" SET SCHEMA novara_database;
ALTER TABLE public."ModifierOption" SET SCHEMA novara_database;
ALTER TABLE public."ModifierOptionRecipeItem" SET SCHEMA novara_database;
ALTER TABLE public."PasswordResetToken" SET SCHEMA novara_database;
ALTER TABLE public."Payment" SET SCHEMA novara_database;
ALTER TABLE public."PlatformStaff" SET SCHEMA novara_database;
ALTER TABLE public."PlatformTicket" SET SCHEMA novara_database;
ALTER TABLE public."Product" SET SCHEMA novara_database;
ALTER TABLE public."ProductModifierGroup" SET SCHEMA novara_database;
ALTER TABLE public."Purchase" SET SCHEMA novara_database;
ALTER TABLE public."PurchaseItem" SET SCHEMA novara_database;
ALTER TABLE public."Recipe" SET SCHEMA novara_database;
ALTER TABLE public."RecipeIngredient" SET SCHEMA novara_database;
ALTER TABLE public."RefreshToken" SET SCHEMA novara_database;
ALTER TABLE public."Refund" SET SCHEMA novara_database;
ALTER TABLE public."RefundItem" SET SCHEMA novara_database;
ALTER TABLE public."SalesOrder" SET SCHEMA novara_database;
ALTER TABLE public."SalesOrderItem" SET SCHEMA novara_database;
ALTER TABLE public."SalesOrderItemModifier" SET SCHEMA novara_database;
ALTER TABLE public."SalesOrderItemModifierEffect" SET SCHEMA novara_database;
ALTER TABLE public."Shift" SET SCHEMA novara_database;
ALTER TABLE public."StockLevel" SET SCHEMA novara_database;
ALTER TABLE public."StockMovement" SET SCHEMA novara_database;
ALTER TABLE public."Stocktake" SET SCHEMA novara_database;
ALTER TABLE public."StocktakeLine" SET SCHEMA novara_database;
ALTER TABLE public."Subscription" SET SCHEMA novara_database;
ALTER TABLE public."SubscriptionPlan" SET SCHEMA novara_database;
ALTER TABLE public."Supplier" SET SCHEMA novara_database;
ALTER TABLE public."TeamInvitation" SET SCHEMA novara_database;
ALTER TABLE public."TeamInvitationBranch" SET SCHEMA novara_database;
ALTER TABLE public."Tenant" SET SCHEMA novara_database;
ALTER TABLE public."User" SET SCHEMA novara_database;

-- Keep the application schema private to the backend database owner.
REVOKE ALL ON ALL TABLES IN SCHEMA novara_database FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA novara_database FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA novara_database REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA novara_database REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
