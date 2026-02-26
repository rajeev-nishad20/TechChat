import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Brain,
  ChevronRight,
  Clock3,
  Command,
  Copy,
  Download,
  History,
  LayoutDashboard,
  Menu,
  Mic,
  Moon,
  Plus,
  Send,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Wand2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "techchat_ultra_messages_v1";
const SETTINGS_KEY = "techchat_ultra_settings_v1";

const promptLibrary = [
  "Explain dynamic programming with a practical pattern list.",
  "Optimize this React component for fewer re-renders.",
  "Generate a system design interview answer structure.",
  "Debug a Node API returning 500 intermittently.",
  "Create SQL indexing strategy for high-traffic queries.",
  "Give me a 7-day DSA preparation roadmap."
];

const topicRules = {
  DSA: /\b(array|linked list|tree|graph|stack|queue|heap|trie|dfs|bfs)\b/i,
  Algorithms: /\b(algorithm|complexity|big o|recursion|greedy|dp|dynamic programming)\b/i,
  WebDev: /\b(html|css|javascript|react|node|express|api|frontend|backend)\b/i,
  Debugging: /\b(debug|error|exception|fix|trace|issue|bug)\b/i,
  Interview: /\b(interview|leetcode|problem|approach|optimization|system design)\b/i
};

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeText(text) {
  return String(text || "").trim();
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function detectTopics(message) {
  const labels = Object.entries(topicRules)
    .filter(([, pattern]) => pattern.test(message))
    .map(([label]) => label);
  return labels.length ? labels : ["Other"];
}

function getApiCandidates(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const host = window.location.hostname || "localhost";
  const sameOrigin = normalizedPath;
  const localhost = `http://localhost:5000${normalizedPath}`;
  const hostBased = `http://${host}:5000${normalizedPath}`;

  return Array.from(new Set([sameOrigin, localhost, hostBased]));
}

async function requestWithFallback(path, options = {}, timeoutMs = 15000) {
  const urls = getApiCandidates(path);
  let lastError = null;

  for (const url of urls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(options.headers || {})
        }
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to reach backend server.");
}

export default function App() {
  const { toast } = useToast();
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const [activeTab, setActiveTab] = useState("chat");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState({ label: "Checking server...", tone: "default" });
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved
        ? JSON.parse(saved)
        : { theme: "dark", autoScroll: true, compactMode: false, animations: true };
    } catch {
      return { theme: "dark", autoScroll: true, compactMode: false, animations: true };
    }
  });

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-200)));
    if (settings.autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, settings.autoScroll]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const isDark = settings.theme === "dark" || (settings.theme === "system" && media.matches);
      root.classList.toggle("dark", isDark);
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [settings.theme]);

  useEffect(() => {
    requestWithFallback("/config")
      .then((res) => res.json())
      .then((data) => {
        const configured = Boolean(data.openaiConfigured ?? data.geminiConfigured);
        if (configured) {
          setStatus({ label: `Connected • ${data.model}`, tone: "ok" });
        } else {
          setStatus({ label: "Provider not configured", tone: "warn" });
        }
      })
        .catch(() => setStatus({ label: "Server unavailable", tone: "error" }));
  }, []);

  useEffect(() => {
    const speechApi = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!speechApi) return;

    const recognition = new speechApi();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (e) => {
      setDraft((prev) => `${prev} ${e.results?.[0]?.[0]?.transcript || ""}`.trim());
    };

    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    const keyHandler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        sendMessage();
      }
      if (event.key === "/" && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        const el = document.getElementById("chat-draft");
        el?.focus();
      }
    };

    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [draft, messages]);

  const stats = useMemo(() => {
    const userMessages = messages.filter((item) => item.role === "user");
    const botMessages = messages.filter((item) => item.role === "bot");
    const avgLen = userMessages.length
      ? Math.round(userMessages.reduce((sum, item) => sum + item.text.length, 0) / userMessages.length)
      : 0;
    const avgLatency = botMessages.length
      ? botMessages.reduce((sum, item) => sum + (item.responseMs || 0), 0) / botMessages.length
      : 0;

    const topicMap = {};
    userMessages.forEach((item) => {
      detectTopics(item.text).forEach((topic) => {
        topicMap[topic] = (topicMap[topic] || 0) + 1;
      });
    });

    return {
      userCount: userMessages.length,
      botCount: botMessages.length,
      avgLen,
      avgLatency,
      topicMap
    };
  }, [messages]);

  const historyItems = useMemo(() => {
    const filtered = messages.filter((item) => item.role === "user");
    if (!historyQuery) {
      return filtered.slice().reverse();
    }
    return filtered
      .filter((item) => item.text.toLowerCase().includes(historyQuery.toLowerCase()))
      .slice()
      .reverse();
  }, [messages, historyQuery]);

  async function sendMessage(overrideText) {
    const message = safeText(overrideText ?? draft);
    if (!message || loading) return;
    if (message.length > 3000) {
      toast({
        title: "Message too long",
        description: "Keep input below 3000 characters."
      });
      return;
    }

    const userMessage = {
      id: createId(),
      role: "user",
      text: message,
      time: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setLoading(true);
    setStatus({ label: "Generating response...", tone: "default" });
    const startedAt = performance.now();

    try {
      const res = await requestWithFallback("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          message,
          history: [...messages, userMessage].slice(-12).map((item) => ({
            role: item.role === "user" ? "user" : "model",
            text: item.text
          }))
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Request failed");
      }

      const botMessage = {
        id: createId(),
        role: "bot",
        text: data.reply,
        time: new Date().toISOString(),
        responseMs: performance.now() - startedAt,
        fallback: Boolean(data.fallback)
      };

      setMessages((prev) => [...prev, botMessage]);
      setStatus({
        label: data.fallback ? "Fallback response active" : `Connected • ${data.model || "AI"}`,
        tone: data.fallback ? "warn" : "ok"
      });
    } catch (error) {
      const readableError =
        error?.name === "AbortError"
          ? "Request timed out. Backend may be offline."
          : error?.message || "Failed to fetch from backend.";

      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "bot",
          text: `⚠️ ${readableError}`,
          time: new Date().toISOString()
        }
      ]);
      setStatus({ label: "Response failed", tone: "error" });
      toast({
        title: "Request failed",
        description: readableError,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  function runPrompt(prompt) {
    setDraft(prompt);
    setActiveTab("chat");
  }

  function clearChat() {
    setMessages([]);
    toast({ title: "Conversation cleared", description: "All messages have been removed." });
  }

  function exportChat() {
    const payload = {
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `techchat-ultra-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Chat exported", description: "Saved as JSON file." });
  }

  function importChat(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        if (!Array.isArray(parsed.messages)) {
          throw new Error("Invalid file format");
        }

        const normalized = parsed.messages.map((item) => ({
          id: item.id || createId(),
          role: item.role === "user" ? "user" : "bot",
          text: safeText(item.text),
          time: item.time || new Date().toISOString(),
          responseMs: item.responseMs || 0,
          fallback: Boolean(item.fallback)
        }));

        setMessages(normalized);
        toast({ title: "Chat imported", description: `${normalized.length} messages loaded.` });
      } catch (error) {
        toast({
          title: "Import failed",
          description: error.message,
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  }

  function copyMessage(text) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Message copied to clipboard." });
  }

  function removeMessage(id) {
    setMessages((prev) => prev.filter((item) => item.id !== id));
  }

  function startVoiceInput() {
    if (!recognitionRef.current) {
      toast({ title: "Voice not supported", description: "Browser speech API is unavailable." });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  }

  const topicEntries = Object.entries(stats.topicMap).sort((a, b) => b[1] - a[1]);

  const NavPanel = (
    <Card className="h-full border-border/60 bg-background/70 backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar className="ring-2 ring-primary/30">
            <AvatarFallback>TC</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg">TechChat Ultra</CardTitle>
            <CardDescription>Advanced AI workspace</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant={activeTab === "chat" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("chat")}>
          <Sparkles className="mr-2 h-4 w-4" /> Chat Studio
        </Button>
        <Button variant={activeTab === "history" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("history")}>
          <History className="mr-2 h-4 w-4" /> History Vault
        </Button>
        <Button variant={activeTab === "analytics" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("analytics")}>
          <LayoutDashboard className="mr-2 h-4 w-4" /> Analytics
        </Button>
        <Button variant={activeTab === "workspace" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("workspace")}>
          <Settings className="mr-2 h-4 w-4" /> Workspace
        </Button>

        <Separator />
        <div className="space-y-2">
          <p className="text-xs uppercase text-muted-foreground">Live Status</p>
          <Badge
            variant={status.tone === "error" ? "destructive" : "secondary"}
            className="w-full justify-center py-1 text-xs"
          >
            {status.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="app-background min-h-screen bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-20 top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl animate-blob" />
          <div className="absolute right-0 top-32 h-64 w-64 rounded-full bg-chart-2/20 blur-3xl animate-blob animation-delay-2" />
          <div className="absolute bottom-8 left-1/3 h-60 w-60 rounded-full bg-chart-4/20 blur-3xl animate-blob animation-delay-4" />
        </div>

        <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 gap-4 p-4 lg:grid-cols-[280px_1fr] lg:p-6">
          <div className="hidden lg:block animate-fade-up">{NavPanel}</div>

          <div className="space-y-4">
            <Card className="border-border/60 bg-background/70 backdrop-blur-xl animate-fade-up">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-primary" />
                    <h1 className="text-xl font-semibold">AI Productivity Workspace</h1>
                    <Badge variant="outline">Extreme Mode</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    shadcn-powered interface with deep chat tools, analytics, and automation workflows.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="icon" className="lg:hidden">
                        <Menu className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[280px] p-0">
                      <SheetHeader className="p-4 pb-0">
                        <SheetTitle>Navigation</SheetTitle>
                        <SheetDescription>Switch workspace sections.</SheetDescription>
                      </SheetHeader>
                      <div className="p-4">{NavPanel}</div>
                    </SheetContent>
                  </Sheet>

                  <Select
                    value={settings.theme}
                    onValueChange={(value) => setSettings((prev) => ({ ...prev, theme: value }))}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            theme: prev.theme === "dark" ? "light" : "dark"
                          }))
                        }
                      >
                        {settings.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle theme quickly</TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Command className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={exportChat}>
                        <Download className="mr-2 h-4 w-4" /> Export chat
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                        <Plus className="mr-2 h-4 w-4" /> Import chat
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDraft(promptLibrary[0])}>
                        <Sparkles className="mr-2 h-4 w-4" /> Insert smart prompt
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-up animation-delay-1">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="workspace">Workspace</TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="mt-4">
                <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
                  <Card className="border-border/60 bg-background/70 backdrop-blur-xl">
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" /> Conversation Studio
                          </CardTitle>
                          <CardDescription>
                            Press <Badge variant="outline">Ctrl + Enter</Badge> to send quickly.
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" onClick={startVoiceInput}>
                                <Mic className={cn("h-4 w-4", isListening && "animate-pulse text-destructive")} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Voice input</TooltipContent>
                          </Tooltip>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Clear full conversation?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. You can export before clearing.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={clearChat}>Clear</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <ScrollArea className="h-[52vh] rounded-xl border border-border/60 bg-muted/20 p-3">
                        <div ref={listRef} className="space-y-3">
                          {!messages.length && (
                            <Card className="border-dashed bg-background/60 animate-fade-up">
                              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                                Start with a prompt from the library to see enhanced responses and analytics.
                              </CardContent>
                            </Card>
                          )}

                          {messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={cn(
                                "message-enter",
                                "rounded-xl border p-3 shadow-sm",
                                msg.role === "user"
                                  ? "ml-auto max-w-[90%] border-primary/40 bg-primary/10"
                                  : "mr-auto max-w-[95%] border-border/70 bg-background"
                              )}
                            >
                              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Badge variant={msg.role === "user" ? "default" : "secondary"}>
                                    {msg.role === "user" ? "You" : "Assistant"}
                                  </Badge>
                                  {msg.fallback && <Badge variant="outline">Fallback</Badge>}
                                  <span>{formatTime(msg.time)}</span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyMessage(msg.text)}>
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => removeMessage(msg.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>

                              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                            </div>
                          ))}

                          {loading && (
                            <div className="rounded-xl border border-border/70 bg-background p-3 animate-pulse">
                              <p className="text-sm text-muted-foreground">Generating a detailed answer...</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>

                      <div className="space-y-2 rounded-xl border border-border/60 bg-background/80 p-3">
                        <Textarea
                          id="chat-draft"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Ask deep coding questions, system design, debugging, architecture, optimization..."
                          className={cn("min-h-[120px] transition-all", settings.compactMode && "min-h-[80px]")}
                        />

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock3 className="h-3.5 w-3.5" />
                            {stats.avgLatency ? `${(stats.avgLatency / 1000).toFixed(2)}s avg latency` : "No latency data yet"}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => sendMessage(promptLibrary[Math.floor(Math.random() * promptLibrary.length)])}>
                              <Wand2 className="mr-2 h-4 w-4" /> Surprise Prompt
                            </Button>
                            <Button onClick={() => sendMessage()} disabled={loading}>
                              <Send className="mr-2 h-4 w-4" /> {loading ? "Sending..." : "Send"}
                            </Button>
                          </div>
                        </div>

                        <Progress value={Math.min(100, (draft.length / 3000) * 100)} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <Card className="border-border/60 bg-background/70 backdrop-blur-xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Prompt Library</CardTitle>
                        <CardDescription>Tap to inject advanced prompts.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {promptLibrary.map((prompt) => (
                          <Button
                            key={prompt}
                            variant="outline"
                            className="h-auto w-full justify-between whitespace-normal text-left"
                            onClick={() => runPrompt(prompt)}
                          >
                            <span className="line-clamp-2 text-xs">{prompt}</span>
                            <ChevronRight className="ml-2 h-4 w-4 shrink-0" />
                          </Button>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-background/70 backdrop-blur-xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Capabilities</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="item-1">
                            <AccordionTrigger>Deep coding analysis</AccordionTrigger>
                            <AccordionContent>
                              Generates architecture reviews, bug root-cause breakdowns, and optimized code plans.
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="item-2">
                            <AccordionTrigger>Interview prep</AccordionTrigger>
                            <AccordionContent>
                              Builds structured answers for DSA, LLD, HLD, and behavioral rounds.
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="item-3">
                            <AccordionTrigger>Workflow acceleration</AccordionTrigger>
                            <AccordionContent>
                              Includes history reuse, import/export, shortcuts, and analytics tracking.
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <Card className="border-border/60 bg-background/70 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" /> Searchable History Vault
                    </CardTitle>
                    <CardDescription>Reuse prompts instantly and clean old messages selectively.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      placeholder="Search by keyword..."
                      value={historyQuery}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                    />

                    <ScrollArea className="h-[58vh] rounded-xl border border-border/60 p-3">
                      <div className="space-y-2">
                        {!historyItems.length && (
                          <p className="text-sm text-muted-foreground">No matching history found.</p>
                        )}

                        {historyItems.map((item) => (
                          <Card key={item.id} className="border-border/60 bg-background/80 message-enter">
                            <CardContent className="flex items-center justify-between gap-3 p-3">
                              <div>
                                <p className="line-clamp-2 text-sm">{item.text}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{formatTime(item.time)}</p>
                              </div>

                              <div className="flex shrink-0 items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => runPrompt(item.text)}>Reuse</Button>
                                <Button variant="ghost" size="icon" onClick={() => copyMessage(item.text)}>
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => removeMessage(item.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics" className="mt-4">
                <div className="grid gap-4 lg:grid-cols-3">
                  <Card className="border-border/60 bg-background/70 backdrop-blur-xl">
                    <CardHeader>
                      <CardDescription>Total user prompts</CardDescription>
                      <CardTitle className="text-3xl">{stats.userCount}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress value={Math.min(100, (stats.userCount / 100) * 100)} />
                    </CardContent>
                  </Card>

                  <Card className="border-border/60 bg-background/70 backdrop-blur-xl">
                    <CardHeader>
                      <CardDescription>Average prompt length</CardDescription>
                      <CardTitle className="text-3xl">{stats.avgLen}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress value={Math.min(100, (stats.avgLen / 300) * 100)} />
                    </CardContent>
                  </Card>

                  <Card className="border-border/60 bg-background/70 backdrop-blur-xl">
                    <CardHeader>
                      <CardDescription>Avg response time</CardDescription>
                      <CardTitle className="text-3xl">{(stats.avgLatency / 1000 || 0).toFixed(2)}s</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="h-4 w-4" /> Live from session interactions
                    </CardContent>
                  </Card>
                </div>

                <Card className="mt-4 border-border/60 bg-background/70 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Brain className="h-4 w-4 text-primary" /> Topic Intelligence
                    </CardTitle>
                    <CardDescription>Distribution of your prompt intent.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!topicEntries.length && <p className="text-sm text-muted-foreground">No topic data yet.</p>}
                    {topicEntries.map(([topic, count]) => (
                      <div key={topic} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{topic}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                        <Progress value={(count / Math.max(topicEntries[0]?.[1] || 1, 1)) * 100} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="workspace" className="mt-4">
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="border-border/60 bg-background/70 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="text-base">Interface Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">Auto-scroll chat</p>
                          <p className="text-xs text-muted-foreground">Follow latest messages automatically.</p>
                        </div>
                        <Switch
                          checked={settings.autoScroll}
                          onCheckedChange={(value) => setSettings((prev) => ({ ...prev, autoScroll: value }))}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">Compact mode</p>
                          <p className="text-xs text-muted-foreground">Reduce spacing for dense view.</p>
                        </div>
                        <Switch
                          checked={settings.compactMode}
                          onCheckedChange={(value) => setSettings((prev) => ({ ...prev, compactMode: value }))}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">UI animations</p>
                          <p className="text-xs text-muted-foreground">Enable premium motion effects.</p>
                        </div>
                        <Switch
                          checked={settings.animations}
                          onCheckedChange={(value) => setSettings((prev) => ({ ...prev, animations: value }))}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60 bg-background/70 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="text-base">Data Operations</CardTitle>
                      <CardDescription>Manage local workspace data and backups.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button className="w-full justify-start" variant="secondary" onClick={exportChat}>
                        <Download className="mr-2 h-4 w-4" /> Export conversation
                      </Button>
                      <Button className="w-full justify-start" variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Plus className="mr-2 h-4 w-4" /> Import conversation
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button className="w-full justify-start" variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete all messages
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete all local workspace data?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This removes messages, topic analytics, and history references stored in this browser.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={clearChat}>Confirm Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                        Tip: Type <Badge variant="outline">/</Badge> anywhere to quickly jump to input.
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={importChat}
        />

        <Toaster />
      </div>
    </TooltipProvider>
  );
}
