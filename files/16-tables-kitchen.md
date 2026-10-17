# 16 Tables and kitchen

## Real-world example

At 13:10 Maya seats four guests at table T4. She adds 2 lattes and 2 Chicken Momos on the waiter screen and presses Send to kitchen. Bikash's kitchen screen shows a new ticket with a timer. He taps Start, then Ready after six minutes. Maya's phone shows T4 ready, she serves the table and later marks the items served. The guests ask for the bill and Anil takes payment at the counter against the same order.

## Models

| Model | Fields |
|---|---|
| DiningTable | id, tenantId, branchId, name, section, seats, sortOrder, isActive. Unique (branchId, name) |
| Order (additional fields) | tableId, guestCount, billRequestedAt |
| OrderItem (kitchen fields) | kitchenStatus (NEW, PREPARING, READY, SERVED), sentToKitchenAt, preparingAt, readyAt, servedAt, station |

Table status is derived, not stored: FREE when no OPEN order references it, OCCUPIED when one does, BILL_REQUESTED when that order has `billRequestedAt`.

Item kitchen flow:

```
NEW -> PREPARING -> READY -> SERVED
```

Items not sent yet have `sentToKitchenAt` null and are not shown in the kitchen.

## Endpoints

| Method and path | Permission | Purpose |
|---|---|---|
| GET /tables?branchId= | tables.read | Tables with derived status and open order summary |
| POST /tables | settings.manage | Create |
| PATCH /tables/:id | settings.manage | Rename, move, deactivate |
| POST /orders/:id/send-to-kitchen | orders.update | Send unsent items |
| POST /orders/:id/request-bill | orders.update | Set billRequestedAt |
| GET /kitchen/queue?branchId=&station= | kitchen.orders.read | Active tickets |
| PATCH /kitchen/items/:id | kitchen.orders.update | NEW to PREPARING, PREPARING to READY |
| PATCH /orders/:id/items/:itemId/served | orders.update | READY to SERVED |
| GET /orders/ready?branchId= | orders.read | Ready items for waiters |

## Backend logic

### Open or reuse a table order

When a waiter selects a table the API looks for an OPEN order with that `tableId` in the branch and returns it. If none exists, creating an order with `tableId` creates it. A second OPEN order for the same table is refused with 409 TABLE_OCCUPIED.

### Send to kitchen

1. Order must be OPEN and in scope.
2. All items with `sentToKitchenAt` null get the current time and status NEW.
3. Response returns the items sent so the UI can print a kitchen ticket if the branch uses printers.
4. Audit is not written for routine sends. Voids after sending are audited.

### Kitchen queue

```sql
SELECT oi.id, oi."productName", oi.quantity, oi.note, oi."kitchenStatus", oi."sentToKitchenAt",
       o.id AS "orderId", o."orderNumber", o.type, t.name AS "tableName"
FROM "OrderItem" oi
JOIN "Order" o ON o.id = oi."orderId"
LEFT JOIN "DiningTable" t ON t.id = o."tableId"
WHERE o."tenantId" = $1 AND o."branchId" = $2 AND o.status = 'OPEN'
  AND oi."sentToKitchenAt" IS NOT NULL
  AND oi."kitchenStatus" IN ('NEW', 'PREPARING')
ORDER BY oi."sentToKitchenAt"
```

The response is grouped by order and sorted oldest first. Modifier names are included for each item.

### Transitions

A transition is accepted only in the order shown above and only one step forward. Skipping or going backwards returns 409. The kitchen role can set PREPARING and READY, never SERVED. A manager can reset an item with a reason.

### Voiding after sending

A waiter cannot remove an item whose status is PREPARING or later. A manager can, with a reason, and the kitchen queue shows the item as cancelled until acknowledged.

### Completion

An order with unserved items can still be paid. Payment is independent of kitchen status. Stock is deducted at payment (see 07 and 09).

## Frontend logic

### Tables screen (`/tables`)

Grid grouped by section with a card per table: name, seats, status colour (green free, blue occupied, amber bill requested), elapsed time and running total for occupied tables. Tapping a free table opens the POS in table mode, an occupied one opens its order. A branch manager edits tables from settings with drag to reorder.

### Waiter order screen

Same POS grid with the table header, a Send to kitchen button that sends only unsent lines, and a Request bill button. Items show a status chip (Sent, Preparing, Ready, Served).

### Ready alerts

The waiter dashboard polls `/orders/ready` every 5 seconds while visible and shows a toast with a short sound when new READY items appear for the waiter's tables.

### Kitchen screen (`/kitchen`)

Full-screen board of ticket cards, one per order, oldest first. Each card shows table or order number, items with modifiers and notes, and a timer. Timer colours: green under 5 minutes, amber 5 to 10, red over 10 (configurable per branch). Big buttons Start and Ready per item or for the whole ticket. A sound plays for a new ticket. Polling every 5 seconds with `refetchInterval`, paused when the tab is hidden. Updates are optimistic and reverted on error.

### States

Empty board shows "No active orders". A connection banner appears when polls fail.

### Realtime later

Server-sent events can replace polling without changing the API shape, using the same queue endpoint as the initial load.

## Tests

A second OPEN order for the same table is refused. Send to kitchen only touches unsent items. Kitchen user cannot set SERVED or read payments. Skipping a status returns 409. Waiter cannot void a PREPARING item. Queue is sorted oldest first and scoped by branch.
