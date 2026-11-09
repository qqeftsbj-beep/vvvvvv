export type OwnerNotificationType = "submission" | "request";
export type OwnerNotificationFilter = "all" | "unread" | "submission" | "request";
export type OwnerNotificationPreferences = { showSubmissions: boolean; showRequests: boolean; showToast: boolean };
export type OwnerNotificationItem = { id: string; type: OwnerNotificationType; sourceId: string; title: string; body: string; createdAt: number; readAt: number | null; href: string };
export type OwnerNotificationFeed = { items: OwnerNotificationItem[]; unreadCount: number; counts: { submission: number; request: number }; page: number; hasMore: boolean; preferences: OwnerNotificationPreferences };
export type CustomerRequestStatus = "new" | "contacted" | "completed";
export type CustomerRequest = { id: string; name: string; phone: string; request: string; source: string; status: CustomerRequestStatus; createdAt: number };
export type CustomerRequestPage = { items: CustomerRequest[]; total: number; hasMore: boolean; page: number };
