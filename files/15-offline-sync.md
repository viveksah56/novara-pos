# 15 Offline POS and sync

## Real-world example

At 14:05 the internet at Thamel drops. Anil keeps selling. The sync badge changes from Online to Offline and counts up to 9 pending orders. At 14:40 the connection returns and the orders upload in order within a few seconds. One order fails because the product Veg Momo was archived by Sita at 14:20, and it appears in a Needs attention list for Ramesh.

## What works offline

| Feature | Offline |
|---|---|
| Browse cached menu, build cart | Yes |
| Create order and take cash payment | Yes |
| Wallet or card payment with typed reference | Yes |
| Print or show a local receipt | Yes, marked Pending |
| Open and close shift | Close is queued, open requires the server unless a shift was already open |
| Reports, stock, settings, refunds | No |

## Client storage (Dexie)

```ts
export class NovaraDB extends Dexie {
  pendingOrders!: Table<PendingOrder, string>;
  menu!: Table<MenuSnapshot, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("novara");
    this.version(1).stores({
      pendingOrders: "clientOrderId, status, createdAt",
      menu: "branchId",
      meta: "key",
    });
  }
}

export type PendingOrder = {
  clientOrderId: string;
  branchId: string;
  tenantId: string;
  payload: unknown;
  localNumber: string;
  status: "pending" | "syncing" | "failed" | "synced";
  attempts: number;
  lastError?: string;
  errorCode?: string;
  createdAt: number;
};
```

`menu` stores the last `/pos/menu` response per branch with its ETag. `meta` stores the last sync time and active branch.

## Client logic

### Connectivity

`navigator.onLine` is only a hint. A heartbeat calls `GET /api/v1/health` every 15 seconds with a 3 second timeout. Two failures mark the app Offline, one success marks it Online.

### Saving an order offline

1. Generate `clientOrderId` (UUID v4) when the cart is submitted. This is also the `Idempotency-Key`.
2. Build the same payload as online. Prices are not included.
3. Compute a local number `TH-OFF-<first 6 characters of the UUID>`.
4. Write to `pendingOrders` with status `pending`.
5. Clear the cart and show the local receipt.

### Sync engine

```ts
export async function syncPending(api: ApiFn) {
  const batch = await db.pendingOrders.where("status").anyOf("pending", "failed").sortBy("createdAt");
  for (const order of batch) {
    if (order.status === "failed" && order.errorCode !== "NETWORK") continue;
    await db.pendingOrders.update(order.clientOrderId, { status: "syncing" });
    try {
      const res = await api("/orders", {
        method: "POST",
        headers: { "Idempotency-Key": order.clientOrderId, "X-Offline-Order": "1" },
        body: JSON.stringify(order.payload),
      });
      if (res.ok) {
        await db.pendingOrders.update(order.clientOrderId, { status: "synced" });
      } else if (res.status >= 500 || res.status === 429) {
        await markRetry(order, "NETWORK");
        break;
      } else {
        const err = await res.json();
        await db.pendingOrders.update(order.clientOrderId, {
          status: "failed",
          errorCode: err.error.code,
          lastError: err.error.message,
        });
      }
    } catch {
      await markRetry(order, "NETWORK");
      break;
    }
  }
  await pruneSynced();
}
```

Rules:

1. Orders sync strictly in creation order so counters and stock reflect reality.
2. Temporary errors (network, 5xx, 429) retry with backoff of 2, 5, 15, 60 seconds and stop the loop to preserve order.
3. Permanent errors (4xx such as unavailable product) move the order to `failed` with the server's code and message, and the loop continues with the next order.
4. Synced rows are pruned after 24 hours.
5. The sync runs on reconnect, every 30 seconds while pending exist, and on app focus.

### Cross-tab safety

A Web Locks API lock named `novara-sync` ensures only one tab runs the sync loop.

### Menu cache

On every online load the POS fetches `/pos/menu` with `If-None-Match`. A 200 replaces the Dexie snapshot, a 304 keeps it. When offline the POS reads from Dexie. A banner shows the menu snapshot time.

### Session while offline

A failed refresh because of a network error never logs the user out. The queue keeps working. The first online sync request triggers the single-flight refresh. If the server returns 401 to the refresh, the app keeps the queue, asks the user to sign in, and resumes syncing after login.

## Server logic

1. `X-Offline-Order: 1` marks the order as created offline. The idempotency key prevents duplicates.
2. Prices come from the current menu. If a price changed meanwhile, the server price wins and the order records the difference in an audit entry.
3. Stock: the customer was already served, so offline orders are accepted even if stock would go negative. The order is flagged `offlineOrigin` and the movement is allowed below zero. The low-stock and negative-stock dashboards expose these cases.
4. If a product is inactive or missing, the order is rejected with 409 UNAVAILABLE_PRODUCT and stays in Needs attention.
5. The server stamps `createdAt` from the client's recorded time (bounded to the last 7 days) so reports place the sale in the right business day.
6. The response includes the real order number, which replaces the local number in the order history on the device.

## Frontend logic

### Sync status component

| State | Display |
|---|---|
| Online, nothing pending | Green dot, Online |
| Offline | Amber badge, Offline, N pending |
| Syncing | Spinner, Syncing N |
| Failed items | Red badge, N need attention, opens the list |

### Needs attention list

Shows failed orders with total, time, error message and actions: Retry, Edit and resubmit (opens the order with the offending line removed), or Discard. Discard requires a manager permission and a reason, and writes an audit entry when the device is online.

### Service worker

Caches the static shell and fonts so the POS loads offline. API responses are not cached by the service worker. Data caching is handled by TanStack Query and Dexie.

### Logout guard

If pending or failed orders exist, logout shows a warning and requires confirmation.

## Edge cases

| Case | Handling |
|---|---|
| Browser storage cleared | Orders are lost, so the logout guard and a persistent-storage request (`navigator.storage.persist()`) are used |
| Clock wrong on the tablet | Server compares to its time and clamps the stamp, large drift is flagged |
| Two tablets create orders offline | Separate UUIDs and counters on the server avoid collisions |
| Sync interrupted midway | Idempotency key makes the retry return the stored order |

## Tests

Duplicate upload creates one order. Ordering is preserved. A failed order does not block later ones. A 5xx stops the loop and retries. Archived product yields a failed entry with the right code. Offline order reduces stock below zero without failing. Only one tab syncs.
