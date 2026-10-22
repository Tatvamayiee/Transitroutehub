import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, MessagesSquare, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  ErrorNote,
  LoadingRows,
  ModuleHeader,
  SignInGate,
  StatusPill,
  type Tone,
} from "@/components/module-kit";
import {
  listMessages,
  listNotifications,
  listThreads,
  markAllNotificationsRead,
  markNotificationRead,
  sendMessage,
  useServerData,
  type Message,
  type Notification,
  type ThreadView,
} from "@/lib/api";
import { ROLE_LABELS, useCurrentUser, useToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Communication & Notifications — Transit Route Hub" },
      {
        name: "description",
        content:
          "Message the counterparty on any shipment and follow booking, payment and verification notifications.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: MessagesPage,
});

const KIND_TONE: Record<Notification["kind"], Tone> = {
  booking: "info",
  payment: "success",
  verification: "warning",
  system: "neutral",
};

function MessagesPage() {
  const user = useCurrentUser();
  const token = useToken();

  const threads = useServerData<ThreadView[]>(
    `threads:${token ?? ""}`,
    () => listThreads(token ?? ""),
    Boolean(token),
  );
  const notifications = useServerData<Notification[]>(
    `notifications:${token ?? ""}`,
    () => listNotifications(token ?? ""),
    Boolean(token),
  );

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (activeThreadId || !threads.data || threads.data.length === 0) return;
    const first = threads.data[0];
    if (first) setActiveThreadId(first.thread.id);
  }, [threads.data, activeThreadId]);

  useEffect(() => {
    if (!activeThreadId || !token) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    void listMessages(token, activeThreadId).then((result) => {
      if (cancelled) return;
      if (result.ok) setMessages(result.value);
      else toast.error(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [activeThreadId, token, threads.data]);

  if (!user || !token) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <ModuleHeader
          icon={MessagesSquare}
          title="Communication & notifications"
          description="Every shipment gets a private thread between the trader and the provider, plus a notification feed for account events."
        />
        <SignInGate what="Shipment messaging" />
      </div>
    );
  }

  const threadList = threads.data ?? [];

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!activeThreadId) return;
    if (!draft.trim()) {
      toast.error("Write a message first.");
      return;
    }
    setSending(true);
    const result = await sendMessage(token ?? "", activeThreadId, draft);
    setSending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setMessages((prev) => [...prev, result.value]);
    setDraft("");
    threads.reload();
  }

  async function markRead(id: string) {
    const result = await markNotificationRead(token ?? "", id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    notifications.reload();
  }

  async function markAll() {
    const result = await markAllNotificationsRead(token ?? "");
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Marked ${result.value} notification(s) as read.`);
    notifications.reload();
  }

  const unread = (notifications.data ?? []).filter((n) => !n.read).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <ModuleHeader
        icon={MessagesSquare}
        title="Communication & notifications"
        description="Shipment threads keep the trader and provider aligned on a booking. Notifications record booking, escrow and verification events."
        actions={
          <>
            <StatusPill label={ROLE_LABELS[user.role]} tone="info" />
            {unread > 0 ? <StatusPill label={`${unread} unread`} tone="warning" /> : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                threads.reload();
                notifications.reload();
              }}
            >
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </>
        }
      />

      <Tabs defaultValue="threads" className="mt-6">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="threads">
            <MessagesSquare className="mr-1.5 size-3.5" /> Threads
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-1.5 size-3.5" /> Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="threads" className="mt-4">
          {threads.error ? <ErrorNote message={threads.error} /> : null}
          {threads.loading && !threads.data ? (
            <LoadingRows label="Loading conversations…" />
          ) : threadList.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  title="No shipment threads yet"
                  description="A thread is created automatically for every booking."
                  action={
                    <Button asChild variant="outline">
                      <Link to="/catalog">Book cargo space</Link>
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Shipments</CardTitle>
                  <CardDescription>{threadList.length} conversation(s)</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[420px]">
                    <ul>
                      {threadList.map((thread) => (
                        <li key={thread.thread.id}>
                          <button
                            type="button"
                            onClick={() => setActiveThreadId(thread.thread.id)}
                            className={cn(
                              "w-full border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-secondary",
                              activeThreadId === thread.thread.id && "bg-secondary",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium">{thread.subject}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {thread.messageCount}
                              </span>
                            </div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {thread.counterpartyName} · {thread.counterpartyRole}
                            </div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {thread.lastMessage}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {threadList.find((t) => t.thread.id === activeThreadId)?.subject ??
                      "Select a thread"}
                  </CardTitle>
                  <CardDescription>
                    Messages are visible only to the trader, the provider and administrators.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <ScrollArea className="h-[300px] rounded-md border border-border p-3">
                    {messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No messages yet — say hello.</p>
                    ) : (
                      <ul className="grid gap-3">
                        {messages.map((message) => {
                          const mine = message.senderId === user.id;
                          return (
                            <li
                              key={message.id}
                              className={cn("flex flex-col", mine ? "items-end" : "items-start")}
                            >
                              <div
                                className={cn(
                                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                                  mine
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-secondary-foreground",
                                )}
                              >
                                {message.body}
                              </div>
                              <span className="mt-1 text-xs text-muted-foreground">
                                {mine ? "You" : message.senderName} ·{" "}
                                {new Date(message.createdAt).toLocaleString()}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </ScrollArea>

                  <form className="flex gap-2" onSubmit={send}>
                    <Input
                      placeholder="Write a message about this shipment…"
                      aria-label="Message"
                      value={draft}
                      maxLength={1000}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <Button type="submit" disabled={sending || !activeThreadId}>
                      <Send className="size-4" /> {sending ? "Sending…" : "Send"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Notification feed</CardTitle>
                <CardDescription>
                  Booking, escrow and verification events raised for your account.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" disabled={unread === 0} onClick={markAll}>
                Mark all read
              </Button>
            </CardHeader>
            <CardContent>
              {notifications.error ? <ErrorNote message={notifications.error} /> : null}
              {notifications.loading && !notifications.data ? (
                <LoadingRows label="Loading notifications…" />
              ) : (notifications.data ?? []).length === 0 ? (
                <EmptyState title="Nothing to report" description="New events will show up here." />
              ) : (
                <ul className="grid gap-2">
                  {(notifications.data ?? []).map((notification) => (
                    <li key={notification.id}>
                      <div
                        className={cn(
                          "rounded-lg border border-border px-4 py-3",
                          !notification.read && "bg-secondary/60",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <StatusPill
                              label={notification.kind}
                              tone={KIND_TONE[notification.kind]}
                            />
                            <span className="text-sm font-medium">{notification.title}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(notification.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                        <Separator className="my-2" />
                        <div className="flex items-center gap-2">
                          {notification.link ? (
                            <Button asChild size="sm" variant="ghost">
                              <a href={notification.link}>Open</a>
                            </Button>
                          ) : null}
                          {!notification.read ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markRead(notification.id)}
                            >
                              Mark read
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Read</span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
