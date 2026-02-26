const MAX_HISTORY_ITEMS = 100;
const CHAT_STORAGE_KEY = "techchat_messages_v3";
const UI_STORAGE_KEY = "techchat_ui_v3";
const ANALYTICS_STORAGE_KEY = "techchat_analytics_v3";

const state = {
  currentSection: "chatSection",
  isSidebarCollapsed: false,
  messages: [],
  analytics: {
    messagesCount: 0,
    totalLength: 0,
    avgResponseTime: 0,
    responseTimeTotal: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
    topics: {}
  },
  chart: null,
  serverConfig: {
    geminiConfigured: false,
    model: "unknown"
  },
  theme: "dark",
  speechRecognition: null,
  isListening: false
};

const dom = {
  dashboard: document.querySelector(".dashboard"),
  sidebar: document.querySelector(".sidebar"),
  menuToggle: document.getElementById("menuToggle"),
  toggleSidebar: document.getElementById("toggleSidebar"),
  toggleIcon: document.querySelector("#toggleSidebar i"),
  chatSectionBtn: document.getElementById("chatSectionBtn"),
  historySectionBtn: document.getElementById("historySectionBtn"),
  analyticsBtn: document.getElementById("analyticsBtn"),
  profileAvatar: document.querySelector(".user-menu .avatar"),
  chatWindow: document.getElementById("chatWindow"),
  chatStatus: document.getElementById("chatStatus"),
  userInput: document.getElementById("userInput"),
  sendBtn: document.getElementById("sendBtn"),
  micBtn: document.getElementById("micBtn"),
  clearChatBtn: document.getElementById("clearChatBtn"),
  exportChatBtn: document.getElementById("exportChatBtn"),
  themeBtn: document.getElementById("themeBtn"),
  historyList: document.getElementById("historyList"),
  historyEmpty: document.getElementById("historyEmpty"),
  shareBtn: document.getElementById("shareBtn"),
  shareModal: document.getElementById("shareModal"),
  closeShare: document.getElementById("closeShare"),
  qrCode: document.getElementById("qrCode"),
  desktopLink: document.getElementById("desktopLink"),
  mobileLink: document.getElementById("mobileLink"),
  tabletLink: document.getElementById("tabletLink"),
  sections: Array.from(document.querySelectorAll("main section")),
  topicChart: document.getElementById("topicChart")
};

function saveUIState() {
  const payload = {
    currentSection: state.currentSection,
    isSidebarCollapsed: state.isSidebarCollapsed,
    theme: state.theme
  };
  localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(payload));
}

function loadUIState() {
  const raw = localStorage.getItem(UI_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.currentSection = parsed.currentSection || "chatSection";
    state.isSidebarCollapsed = Boolean(parsed.isSidebarCollapsed);
    state.theme = parsed.theme || "dark";
  } catch {
    state.currentSection = "chatSection";
  }
}

function saveMessages() {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state.messages.slice(-MAX_HISTORY_ITEMS)));
}

function loadMessages() {
  const raw = localStorage.getItem(CHAT_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.messages = parsed.slice(-MAX_HISTORY_ITEMS);
    }
  } catch {
    state.messages = [];
  }
}

function saveAnalytics() {
  localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(state.analytics));
}

function loadAnalytics() {
  const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state.analytics = {
        ...state.analytics,
        ...parsed
      };
    }
  } catch {
    state.analytics = {
      messagesCount: 0,
      totalLength: 0,
      avgResponseTime: 0,
      responseTimeTotal: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      topics: {}
    };
  }
}

function sanitizeUserText(text) {
  return String(text || "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim();
}

function detectTopics(message) {
  const rules = {
    DSA: /\b(array|linked list|tree|graph|stack|queue|heap|trie|dfs|bfs)\b/i,
    Algorithms: /\b(algorithm|complexity|big o|recursion|greedy|dp|dynamic programming)\b/i,
    WebDev: /\b(html|css|javascript|react|node|express|api|frontend|backend)\b/i,
    Debugging: /\b(debug|error|exception|fix|trace|issue|bug)\b/i,
    Interview: /\b(interview|leetcode|problem|approach|optimization)\b/i
  };

  const found = Object.entries(rules)
    .filter(([, pattern]) => pattern.test(message))
    .map(([label]) => label);

  return found.length ? found : ["Other"];
}

function setChatStatus(text, type = "neutral") {
  if (!dom.chatStatus) return;
  dom.chatStatus.textContent = text;
  dom.chatStatus.dataset.state = type;
}

function renderMessage(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${msg.role === "user" ? "user" : "bot"}`;

  if (msg.role === "bot") {
    wrapper.innerHTML = marked.parse(msg.text || "");
    wrapper.querySelectorAll("pre code").forEach((block) => {
      if (window.hljs) {
        window.hljs.highlightElement(block);
      }
    });
  } else {
    wrapper.textContent = msg.text;
  }

  dom.chatWindow.appendChild(wrapper);
}

function renderMessages() {
  dom.chatWindow.innerHTML = "";

  if (!state.messages.length) {
    dom.chatWindow.innerHTML = `
      <div class="welcome-message">
        <img src="https://ui-avatars.com/api/?name=CB&background=4cc9f0&color=fff&rounded=true&size=64" alt="ChatBot" class="bot-avatar">
        <h2>Hello! 👋</h2>
        <p>Ask me about DSA or coding problems. I'm here to help!</p>
      </div>
    `;
    return;
  }

  state.messages.forEach(renderMessage);
  dom.chatWindow.scrollTop = dom.chatWindow.scrollHeight;
}

function renderHistoryList() {
  dom.historyList.innerHTML = "";

  const userMessages = state.messages.filter((m) => m.role === "user").slice().reverse();

  userMessages.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "history-item";

    const date = new Date(entry.timestamp);
    const topics = detectTopics(entry.text);

    item.innerHTML = `
      <div class="history-item-content">
        <div class="history-message">${entry.text.slice(0, 80)}${entry.text.length > 80 ? "..." : ""}</div>
        <div class="history-meta">
          <span class="history-time">${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          <span class="history-length">${entry.text.length} chars</span>
          <span class="history-topics">${topics.join(", ")}</span>
        </div>
      </div>
    `;

    item.addEventListener("click", () => {
      switchSection("chatSection");
      dom.userInput.value = entry.text;
      dom.userInput.focus();
    });

    dom.historyList.appendChild(item);
  });

  const count = userMessages.length;
  const historyCountBadge = document.querySelector("#historySectionBtn .count");
  if (historyCountBadge) historyCountBadge.textContent = String(count);

  if (dom.historyEmpty) {
    dom.historyEmpty.style.display = count ? "none" : "flex";
  }
}

function updateAnalyticsDisplay() {
  const userMessages = state.messages.filter((m) => m.role === "user");
  const totalLength = userMessages.reduce((sum, msg) => sum + msg.text.length, 0);
  const avgLength = userMessages.length ? Math.round(totalLength / userMessages.length) : 0;

  const sidebarNums = document.querySelectorAll(".stats-widget .number");
  if (sidebarNums[0]) sidebarNums[0].textContent = String(userMessages.length);
  if (sidebarNums[1]) sidebarNums[1].textContent = String(avgLength);

  const statValues = document.querySelectorAll(".stat-value");
  if (statValues[0]) statValues[0].textContent = String(userMessages.length);
  if (statValues[1]) statValues[1].textContent = `${avgLength} chars`;
  if (statValues[3]) statValues[3].textContent = `${(state.analytics.avgResponseTime / 1000 || 0).toFixed(2)}s`;

  updateTopicChart();
}

function updateTopicChart() {
  if (!dom.topicChart || !window.Chart) return;

  const topics = state.analytics.topics || {};
  const labels = Object.keys(topics);
  const values = Object.values(topics);

  if (!labels.length) {
    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }
    return;
  }

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: [
          "rgba(76, 201, 240, 0.85)",
          "rgba(67, 97, 238, 0.85)",
          "rgba(114, 9, 183, 0.85)",
          "rgba(236, 72, 153, 0.85)",
          "rgba(34, 197, 94, 0.85)",
          "rgba(249, 115, 22, 0.85)"
        ]
      }
    ]
  };

  if (state.chart) {
    state.chart.data = data;
    state.chart.update();
    return;
  }

  state.chart = new Chart(dom.topicChart.getContext("2d"), {
    type: "doughnut",
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#e1e9ff"
          }
        }
      }
    }
  });
}

function updateAnalyticsForMessage(userText, responseTimeMs) {
  state.analytics.messagesCount += 1;
  state.analytics.totalLength += userText.length;
  state.analytics.responseTimeTotal += responseTimeMs;
  state.analytics.avgResponseTime = state.analytics.responseTimeTotal / state.analytics.messagesCount;
  state.analytics.maxResponseTime = Math.max(state.analytics.maxResponseTime, responseTimeMs);
  state.analytics.minResponseTime = Math.min(state.analytics.minResponseTime, responseTimeMs);

  const topics = detectTopics(userText);
  topics.forEach((topic) => {
    state.analytics.topics[topic] = (state.analytics.topics[topic] || 0) + 1;
  });

  saveAnalytics();
  updateAnalyticsDisplay();
}

function getConversationForApi() {
  return state.messages.slice(-12).map((item) => ({
    role: item.role === "user" ? "user" : "model",
    text: item.text
  }));
}

async function fetchServerConfig() {
  try {
    const response = await fetch("/config", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Config request failed");

    const data = await response.json();
    state.serverConfig = {
      geminiConfigured: Boolean(data.geminiConfigured),
      model: data.model || "unknown"
    };

    if (state.serverConfig.geminiConfigured) {
      setChatStatus(`Connected • ${state.serverConfig.model}`, "ok");
    } else {
      setChatStatus("Gemini key missing on server", "warn");
    }
  } catch {
    setChatStatus("Server unavailable", "error");
  }
}

function setInputLoading(isLoading) {
  dom.userInput.disabled = isLoading;
  dom.sendBtn.disabled = isLoading;
  dom.sendBtn.innerHTML = isLoading ? '<i class="ri-loader-4-line spin"></i>' : '<i class="ri-send-plane-fill"></i>';
}

async function sendMessage() {
  const raw = dom.userInput.value;
  const message = sanitizeUserText(raw);
  if (!message) return;

  if (message.length > 3000) {
    alert("Message is too long. Keep it under 3000 characters.");
    return;
  }

  const userMsg = { role: "user", text: message, timestamp: new Date().toISOString() };
  state.messages.push(userMsg);
  saveMessages();
  renderMessages();
  renderHistoryList();

  dom.userInput.value = "";
  setInputLoading(true);
  setChatStatus("Thinking...", "neutral");

  const typing = { role: "bot", text: "⏳ Generating response...", timestamp: new Date().toISOString() };
  state.messages.push(typing);
  renderMessages();

  const started = performance.now();

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        message,
        history: getConversationForApi()
      })
    });

    const payload = await response.json();

    state.messages.pop();

    if (!response.ok || !payload.success) {
      const errorText = payload.error || "Unable to process your request right now.";
      state.messages.push({ role: "bot", text: `⚠️ ${errorText}`, timestamp: new Date().toISOString() });
      setChatStatus("Server error", "error");
    } else {
      state.messages.push({ role: "bot", text: payload.reply, timestamp: new Date().toISOString() });
      setChatStatus(`Connected • ${state.serverConfig.model}`, "ok");
      updateAnalyticsForMessage(message, performance.now() - started);
    }
  } catch {
    state.messages.pop();
    state.messages.push({
      role: "bot",
      text: "⚠️ Network error. Please ensure backend server is running.",
      timestamp: new Date().toISOString()
    });
    setChatStatus("Network error", "error");
  } finally {
    if (state.messages.length > MAX_HISTORY_ITEMS) {
      state.messages = state.messages.slice(-MAX_HISTORY_ITEMS);
    }
    saveMessages();
    renderMessages();
    renderHistoryList();
    setInputLoading(false);
  }
}

function switchSection(sectionId) {
  state.currentSection = sectionId;
  dom.sections.forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });

  dom.chatSectionBtn.classList.toggle("active", sectionId === "chatSection");
  dom.historySectionBtn.classList.toggle("active", sectionId === "historySection");
  dom.analyticsBtn.classList.toggle("active", sectionId === "trendSection");
  dom.profileAvatar.classList.toggle("active", sectionId === "profileSection");

  if (window.innerWidth <= 768) {
    dom.sidebar.classList.remove("active");
    dom.menuToggle.textContent = "☰";
    document.body.classList.remove("sidebar-open");
  }

  if (sectionId === "trendSection") {
    updateAnalyticsDisplay();
  }

  saveUIState();
}

function toggleSidebarCollapsed() {
  state.isSidebarCollapsed = !state.isSidebarCollapsed;
  dom.dashboard.classList.toggle("sidebar-collapsed", state.isSidebarCollapsed);
  dom.toggleIcon.className = state.isSidebarCollapsed ? "ri-menu-unfold-line" : "ri-menu-fold-line";
  saveUIState();
}

function toggleTheme() {
  const next = state.theme === "dark" ? "light" : "dark";
  state.theme = next;
  document.body.classList.toggle("light-theme", next === "light");
  saveUIState();
}

function clearChat() {
  const confirmed = window.confirm("Clear all chat messages?");
  if (!confirmed) return;
  state.messages = [];
  saveMessages();
  renderMessages();
  renderHistoryList();
  setChatStatus(`Connected • ${state.serverConfig.model}`, "ok");
}

function exportChat() {
  const data = {
    exportedAt: new Date().toISOString(),
    model: state.serverConfig.model,
    messages: state.messages
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `techchat-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || !dom.micBtn) {
    if (dom.micBtn) dom.micBtn.style.display = "none";
    return;
  }

  const recognition = new SR();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    state.isListening = true;
    dom.micBtn.classList.add("is-listening");
  };

  recognition.onend = () => {
    state.isListening = false;
    dom.micBtn.classList.remove("is-listening");
  };

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    dom.userInput.value = transcript;
    dom.userInput.focus();
  };

  state.speechRecognition = recognition;

  dom.micBtn.addEventListener("click", () => {
    if (state.isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
}

function setupShareModal() {
  if (!dom.shareBtn || !dom.shareModal) return;

  const currentURL = window.location.href;

  if (dom.qrCode && window.QRCode) {
    dom.qrCode.innerHTML = "";
    QRCode.toCanvas(dom.qrCode, currentURL, {
      width: 200,
      margin: 2,
      color: { dark: "#000", light: "#fff" }
    });
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentURL);
      alert("Link copied to clipboard");
    } catch {
      alert("Unable to copy link");
    }
  };

  [dom.desktopLink, dom.mobileLink, dom.tabletLink].forEach((btn) => {
    btn?.addEventListener("click", copyToClipboard);
  });

  dom.shareBtn.addEventListener("click", () => {
    if (navigator.share) {
      navigator.share({
        title: "TechChat",
        text: "Try this AI coding assistant",
        url: currentURL
      }).catch(() => {
        dom.shareModal.classList.add("active");
      });
      return;
    }
    dom.shareModal.classList.add("active");
  });

  dom.closeShare?.addEventListener("click", () => dom.shareModal.classList.remove("active"));
  dom.shareModal.addEventListener("click", (event) => {
    if (event.target === dom.shareModal) {
      dom.shareModal.classList.remove("active");
    }
  });
}

function applyInitialUIState() {
  dom.dashboard.classList.toggle("sidebar-collapsed", state.isSidebarCollapsed);
  dom.toggleIcon.className = state.isSidebarCollapsed ? "ri-menu-unfold-line" : "ri-menu-fold-line";
  document.body.classList.toggle("light-theme", state.theme === "light");
  switchSection(state.currentSection);
}

function bindEvents() {
  dom.chatSectionBtn.addEventListener("click", () => switchSection("chatSection"));
  dom.historySectionBtn.addEventListener("click", () => switchSection("historySection"));
  dom.analyticsBtn.addEventListener("click", () => switchSection("trendSection"));
  dom.profileAvatar.addEventListener("click", () => {
    const toProfile = state.currentSection !== "profileSection";
    switchSection(toProfile ? "profileSection" : "chatSection");
  });

  dom.toggleSidebar?.addEventListener("click", toggleSidebarCollapsed);

  dom.menuToggle?.addEventListener("click", () => {
    const next = !dom.sidebar.classList.contains("active");
    dom.sidebar.classList.toggle("active", next);
    dom.menuToggle.textContent = next ? "×" : "☰";
    document.body.classList.toggle("sidebar-open", next);
  });

  document.addEventListener("click", (event) => {
    if (window.innerWidth <= 768 && !dom.sidebar.contains(event.target) && !dom.menuToggle.contains(event.target)) {
      dom.sidebar.classList.remove("active");
      dom.menuToggle.textContent = "☰";
      document.body.classList.remove("sidebar-open");
    }
  });

  dom.sendBtn.addEventListener("click", sendMessage);
  dom.userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== dom.userInput) {
      event.preventDefault();
      dom.userInput.focus();
    }
    if (event.ctrlKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      clearChat();
    }
  });

  dom.clearChatBtn?.addEventListener("click", clearChat);
  dom.exportChatBtn?.addEventListener("click", exportChat);
  dom.themeBtn?.addEventListener("click", toggleTheme);
}

async function initialize() {
  loadUIState();
  loadMessages();
  loadAnalytics();

  bindEvents();
  setupSpeechRecognition();
  setupShareModal();

  applyInitialUIState();
  renderMessages();
  renderHistoryList();
  updateAnalyticsDisplay();

  await fetchServerConfig();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      setChatStatus("Service worker unavailable", "warn");
    });
  }
}

document.addEventListener("DOMContentLoaded", initialize);
