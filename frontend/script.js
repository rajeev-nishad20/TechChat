// Sidebar Toggle and Touch Handling
const toggleBtn = document.getElementById("toggleSidebar");
const menuToggle = document.getElementById("menuToggle");
const dashboard = document.querySelector(".dashboard");
const toggleIcon = toggleBtn.querySelector("i");
const sidebar = document.querySelector('.sidebar');
let touchStartX = 0;
let touchEndX = 0;

// Menu toggle for mobile
menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("active");
    menuToggle.textContent = sidebar.classList.contains("active") ? "×" : "☰";
});

// Function to toggle sidebar
function toggleSidebar() {
  dashboard.classList.toggle("sidebar-collapsed");
  
  // Update toggle button icon
  if (dashboard.classList.contains("sidebar-collapsed")) {
    toggleIcon.className = "ri-menu-unfold-line";
  } else {
    toggleIcon.className = "ri-menu-fold-line";
  }

  // Save state to localStorage
  localStorage.setItem("sidebarCollapsed", dashboard.classList.contains("sidebar-collapsed"));
}

// Touch events for swipe gestures
let touchStartY = 0;
let isSwiping = false;

document.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
  isSwiping = true;
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!isSwiping) return;
  
  const touchMoveX = e.changedTouches[0].screenX;
  const touchMoveY = e.changedTouches[0].screenY;
  
  // Check if scroll is more vertical than horizontal
  if (Math.abs(touchMoveY - touchStartY) > Math.abs(touchMoveX - touchStartX)) {
    isSwiping = false;
    return;
  }
  
  // Prevent scrolling while swiping horizontally
  if (isSwiping) {
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('touchend', e => {
  if (!isSwiping) return;
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
  isSwiping = false;
});

function handleSwipe() {
  const swipeDistance = touchEndX - touchStartX;
  const threshold = 50; // minimum distance for swipe

  if (Math.abs(swipeDistance) > threshold) {
    if (swipeDistance > 0) { // Right swipe
      dashboard.classList.remove("sidebar-collapsed");
    } else { // Left swipe
      dashboard.classList.add("sidebar-collapsed");
    }
    // Update toggle button icon
    toggleIcon.className = dashboard.classList.contains("sidebar-collapsed") 
      ? "ri-menu-unfold-line" 
      : "ri-menu-fold-line";
    // Save state
    localStorage.setItem("sidebarCollapsed", dashboard.classList.contains("sidebar-collapsed"));
  }
}

// Initialize sidebar state and section from localStorage
document.addEventListener("DOMContentLoaded", () => {
  // Restore sidebar state
  const sidebarCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
  if (sidebarCollapsed) {
    dashboard.classList.add("sidebar-collapsed");
    toggleIcon.className = "ri-menu-unfold-line";
  }
  
  // Restore last active section
  const lastSection = parseInt(localStorage.getItem("currentSection")) || 0;
  showSection(lastSection);

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful');
        // Check if there's an update available
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available
              if (confirm('New version available! Would you like to update?')) {
                window.location.reload();
              }
            }
          });
        });
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
        // Continue without service worker
        console.log('App will run without offline support');
      });
  }
});

toggleBtn.addEventListener("click", toggleSidebar);

// Handle sidebar touch events on mobile
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 768 && 
      !sidebar.contains(e.target) && 
      !menuToggle.contains(e.target) &&
      sidebar.classList.contains("active")) {
    sidebar.classList.remove("active");
    menuToggle.textContent = "☰";
    // Remove body scroll lock
    document.body.classList.remove('sidebar-open');
  }
});

// Prevent touch events from bleeding through sidebar
sidebar.addEventListener('touchmove', (e) => {
  if (window.innerWidth <= 768) {
    e.stopPropagation();
  }
});

// Add body scroll lock when sidebar is open
menuToggle.addEventListener("click", () => {
  sidebar.classList.toggle("active");
  menuToggle.textContent = sidebar.classList.contains("active") ? "×" : "☰";
  document.body.classList.toggle('sidebar-open');
});

// Navigation and UI State Management
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI elements
    const elements = {
        sections: Array.from(document.querySelectorAll("main section")),
        buttons: {
            chat: document.getElementById("chatSectionBtn"),
            history: document.getElementById("historySectionBtn"),
            analytics: document.getElementById("analyticsBtn")
        },
        profile: {
            button: document.querySelector(".user-menu .avatar"),
            section: document.getElementById("profileSection")
        },
        ui: {
            sidebar: document.querySelector('.sidebar'),
            menuToggle: document.getElementById('menuToggle'),
            chatWindow: document.getElementById('chatWindow')
        }
    };

    // Button to section mapping
    const buttonToSectionMap = {
        chatSectionBtn: "chatSection",
        historySectionBtn: "historySection",
        analyticsBtn: "trendSection"
    };

    // Initialize analytics
    loadAnalytics();
    updateAnalyticsDisplay();

    // Set up navigation button click handlers
    Object.entries(elements.buttons).forEach(([key, btn]) => {
        if (btn) {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                
                // Remove active class from all buttons
                Object.values(elements.buttons).forEach(b => b?.classList?.remove("active"));
                
                // Add active class to clicked button
                btn.classList.add("active");
                
                // Find and show corresponding section
                const sectionId = buttonToSectionMap[btn.id];
                const sectionIndex = elements.sections.findIndex(s => s.id === sectionId);
                
                if (sectionIndex !== -1) {
                    showSection(sectionIndex);
                    console.log(`Navigation: ${sectionId}`);
                    
                    // Additional actions for specific sections
                    if (sectionId === 'trendSection') {
                        updateAnalyticsDisplay();
                    }
                }
            });
        }
    });

    // Profile button handler
    if (elements.profile.button && elements.profile.section) {
        elements.profile.button.addEventListener("click", (e) => {
            e.preventDefault();
            const profileIndex = elements.sections.indexOf(elements.profile.section);
            
            if (profileIndex !== -1) {
                const isProfileActive = elements.profile.section.classList.contains('active');
                showSection(isProfileActive ? 0 : profileIndex);
                elements.profile.button.classList.toggle('active', !isProfileActive);
            }
        });
    }

    // Mobile menu handler
    if (elements.ui.menuToggle && elements.ui.sidebar) {
        elements.ui.menuToggle.addEventListener("click", (e) => {
            e.preventDefault();
            const isActive = elements.ui.sidebar.classList.contains('active');
            elements.ui.sidebar.classList.toggle('active');
            elements.ui.menuToggle.textContent = isActive ? '☰' : '×';
            document.body.classList.toggle('sidebar-open', !isActive);
        });
    }

    // Restore last active section
    const lastSection = parseInt(localStorage.getItem("currentSection")) || 0;
    showSection(lastSection);
});

// Profile Avatar Click Handler
document.addEventListener('DOMContentLoaded', () => {
    const userAvatar = document.querySelector(".user-menu .avatar");
    const profileSection = document.getElementById("profileSection");
    const sections = document.querySelectorAll("main section");
    let isProfileOpen = false;

    if (userAvatar && profileSection) {
        userAvatar.addEventListener("click", () => {
            const profileIndex = Array.from(sections).findIndex(section => section.id === "profileSection");
            
            if (profileIndex === -1) {
                console.error("Profile section not found");
                return;
            }

            console.log(`Profile click - current state: ${isProfileOpen ? 'open' : 'closed'}`);
            
            if (isProfileOpen) {
                // If profile is open, close it and show chat section
                showSection(0); // 0 is the index of chat section
                console.log('Switching to chat section');
            } else {
                // If profile is closed, open it
                showSection(profileIndex);
                console.log('Switching to profile section');
            }

            isProfileOpen = !isProfileOpen;
            userAvatar.classList.toggle("active", isProfileOpen);
            
            // Update navigation buttons
            const buttons = document.querySelectorAll(".sidebar nav button");
            buttons.forEach(btn => btn.classList.remove("active"));
            
            if (!isProfileOpen) {
                // Activate chat button when returning to chat
                const chatBtn = document.getElementById("chatSectionBtn");
                if (chatBtn) chatBtn.classList.add("active");
            }
        });
    } else {
        console.error("User avatar or profile section not found");
    }
});

function showSection(index) {
  // Get all sections and validate index
  const sections = document.querySelectorAll("main section");
  if (!sections || sections.length === 0) {
    console.error('No sections found in the document');
    return;
  }
  if (index < 0 || index >= sections.length) {
    console.error(`Invalid section index: ${index}`);
    index = 0; // Default to first section
  }
  
  // Log current transition
  const currentSection = Array.from(sections).find(s => s.classList.contains('active'));
  const targetSection = sections[index];
  console.log(`Transitioning from ${currentSection?.id || 'none'} to ${targetSection.id}`);

  // Map sections to their IDs for button updating
  const sectionIdToButtonId = {
    'chatSection': 'chatSectionBtn',
    'historySection': 'historySectionBtn',
    'trendSection': 'analyticsBtn'
  };

  // Get all UI elements we need
  const elements = {
    userAvatar: document.querySelector('.user-menu .avatar'),
    sidebar: document.querySelector('.sidebar'),
    menuToggle: document.getElementById('menuToggle'),
    buttons: {
      chat: document.getElementById('chatSectionBtn'),
      history: document.getElementById('historySectionBtn'),
      analytics: document.getElementById('analyticsBtn')
    }
  };

  try {
    // 1. Deactivate all sections first
    sections.forEach(section => {
      if (section) {
        // Reset animation
        section.style.animation = 'none';
        section.offsetHeight; // Trigger reflow
        section.style.animation = null;
        // Remove active class
        section.classList.remove('active');
      }
    });

    // 2. Activate target section
    const targetSection = sections[index];
    targetSection.classList.add('active');
    
    // 3. Update navigation button states
    const targetSectionId = targetSection.id;
    Object.values(elements.buttons).forEach(button => {
      if (button) {
        button.classList.remove('active');
      }
    });

    // Activate the corresponding button
    if (targetSectionId in sectionIdToButtonId) {
      const buttonId = sectionIdToButtonId[targetSectionId];
      const button = document.getElementById(buttonId);
      if (button) {
        button.classList.add('active');
      }
    }

    // 4. Handle profile section separately
    const isProfileSection = targetSectionId === 'profileSection';
    if (elements.userAvatar) {
      elements.userAvatar.classList.toggle('active', isProfileSection);
    }

    // 5. Handle mobile-specific behavior
    if (window.innerWidth <= 768) {
      if (elements.sidebar) {
        elements.sidebar.classList.remove('active');
      }
      if (elements.menuToggle) {
        elements.menuToggle.textContent = '☰';
      }
      document.body.classList.remove('sidebar-open');
    }

    // 6. Save state
    localStorage.setItem('currentSection', index);
    localStorage.setItem('lastActiveSection', targetSectionId);

    // 7. Update analytics if needed
    if (targetSectionId === 'trendSection') {
      updateAnalyticsDisplay();
    }

    // 8. Trigger layout updates
    window.dispatchEvent(new Event('resize'));

    console.log(`Successfully switched to section: ${targetSectionId}`);
  } catch (error) {
    console.error('Error switching sections:', error);
  }
}

// Chat Functionality with Mobile Enhancements
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const historyList = document.getElementById("historyList");

// Handle mobile keyboard and touch input
userInput.addEventListener('focus', () => {
  // Add class to body when keyboard is open
  document.body.classList.add('keyboard-open');
  
  // Scroll to bottom when keyboard opens
  setTimeout(() => {
    // First scroll the chat window
    chatWindow.scrollTop = chatWindow.scrollHeight;
    
    // Then make sure the input is visible
    userInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
    
    // For iOS devices
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      document.querySelector('.chat-input').classList.add('keyboard-open');
      // Prevent scroll issues on iOS
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    }
    
    // For Android devices
    if (/Android/.test(navigator.userAgent)) {
      window.scrollTo(0, document.body.scrollHeight);
    }
  }, 300); // Increased timeout for better reliability
});

userInput.addEventListener('touchstart', (e) => {
  // Prevent any default touch behavior that might interfere
  e.stopPropagation();
});

// Handle mobile keyboard hide
userInput.addEventListener('blur', () => {
  // Small delay to ensure proper handling
  setTimeout(() => {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }, 100);
});

// ...existing code...

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;
  
  // Input validation and security
  if (message.length > 2000) {
    appendMessage("bot", "⚠️ Message too long. Please keep it under 2000 characters.");
    return;
  }
  
  // Basic XSS prevention
  const sanitizedMessage = message
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  // Disable input while processing
  userInput.disabled = true;
  sendBtn.disabled = true;

  // User Message
  appendMessage("user", sanitizedMessage);

  // Save to history with enhanced data
  const li = document.createElement("li");
  li.className = "history-item";
  
  const timestamp = new Date();
  const timeStr = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const topics = detectTopics(sanitizedMessage);
  
  li.innerHTML = `
    <div class="history-item-content">
      <div class="history-message">${sanitizedMessage.substring(0, 60)}${sanitizedMessage.length > 60 ? '...' : ''}</div>
      <div class="history-meta">
        <span class="history-time">${timeStr}</span>
        <span class="history-length">${sanitizedMessage.length} chars</span>
        <span class="history-topics">${topics.join(', ')}</span>
      </div>
    </div>
  `;
  
  li.addEventListener('click', () => {
    // Switch to chat section and add message to input
    showSection(0);
    userInput.value = sanitizedMessage;
    userInput.focus();
  });
  
  historyList.appendChild(li);
  updateHistoryEmptyState();
  
  // Update history count in sidebar
  const historyCount = document.querySelector('#historySectionBtn .count');
  if (historyCount && historyList) {
    historyCount.textContent = historyList.children.length;
  }

  userInput.value = "";

  // Show typing indicator
  const typingDiv = document.createElement("div");
  typingDiv.classList.add("message", "bot");
  typingDiv.textContent = "🤖 typing...";
  chatWindow.appendChild(typingDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  const startTime = Date.now();

  try {
    // Get the backend URL dynamically based on current location
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : ':5000';
    const backendURL = `${protocol}//${hostname}${port}/chat`;
    
    console.log('🔗 Connecting to server:', backendURL);
    console.log('📤 Sending request with timeout...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(backendURL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ message: sanitizedMessage }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;
    
    console.log('✅ Got response in', responseTime, 'ms');
    console.log('📝 Reply:', data.reply?.substring(0, 50) + '...' || 'No reply');
    
    typingDiv.remove(); // Remove typing indicator
    
    if (data.reply) {
      appendMessage("bot", data.reply);
      updateAnalytics(sanitizedMessage, responseTime);
    } else if (data.error) {
      appendMessage("bot", `⚠️ Server error: ${data.error}`);
    } else {
      appendMessage("bot", "⚠️ Received empty response from server. Please try again.");
    }
    
  } catch (err) {
    console.error('❌ Error:', err.name, '-', err.message);
    typingDiv.remove();
    
    let errorMessage = "⚠️ ";
    
    if (err.name === 'AbortError') {
      errorMessage = "⚠️ Request timeout. Server is not responding. Make sure the backend server is running on port 5000.";
    } else if (err instanceof TypeError) {
      errorMessage = "⚠️ Network connection failed. Make sure the server is running at http://localhost:5000";
    } else if (err.message.includes('400')) {
      errorMessage = "⚠️ Bad request - please check your message.";
    } else if (err.message.includes('404')) {
      errorMessage = "⚠️ Server endpoint not found. Wrong server address.";
    } else if (err.message.includes('500')) {
      errorMessage = "⚠️ Server error. Please try again in a moment.";
    } else if (err.message.includes('Network')) {
      errorMessage = "⚠️ Network error - make sure the server is running on port 5000.";
    } else if (err.message.includes('Failed to fetch')) {
      errorMessage = "⚠️ Failed to connect to server. Make sure backend is running on http://localhost:5000";
    } else {
      errorMessage = `⚠️ Connection error: ${err.message}`;
    }
    
    appendMessage("bot", errorMessage);
  } finally {
    // Always re-enable input
    userInput.disabled = false;
    sendBtn.disabled = false;
    updateAnalyticsDisplay(); // Update UI
  }
}



// ...existing code...
function appendMessage(sender, text) {
  const div = document.createElement("div");
  div.classList.add("message", sender);

  if (sender === "bot") {
    // Render Markdown as HTML for bot messages
    div.innerHTML = marked.parse(text);
    
    // Make code blocks mobile-friendly
    div.querySelectorAll('pre code').forEach((block) => {
      block.parentNode.classList.add('mobile-friendly-code');
      // Add double-tap to zoom for code blocks on mobile
      block.addEventListener('touchend', (e) => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          block.classList.toggle('zoomed');
        }
      });
    });
  } else {
    div.textContent = text;
  }

  chatWindow.appendChild(div);
  
  // Smooth scroll to new message
  setTimeout(() => {
    div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, 100);
  
  // Ensure chat window scrolls to bottom
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
// ...existing code...


sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});

// Enhanced Analytics Tracking with Real-time Updates
let analyticsData = {
  messagesCount: 0,
  totalLength: 0,
  topics: {},
  responseTimeTotal: 0,
  lastUpdate: new Date().toLocaleDateString(),
  hourlyData: Array(24).fill(0),
  messages: [], // Store detailed message data
  avgResponseTime: 0,
  maxResponseTime: 0,
  minResponseTime: Infinity
};

let chartInstances = {}; // Store chart instances

// Load analytics data from localStorage
function loadAnalytics() {
  const saved = localStorage.getItem('chatAnalytics');
  if (saved) {
    try {
      analyticsData = JSON.parse(saved);
      // Reset if it's a new day
      if (analyticsData.lastUpdate !== new Date().toLocaleDateString()) {
        resetAnalytics();
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
      resetAnalytics();
    }
  } else {
    resetAnalytics();
  }
}

function resetAnalytics() {
  analyticsData = {
    messagesCount: 0,
    totalLength: 0,
    responseTimeTotal: 0,
    topics: {},
    hourlyData: Array(24).fill(0),
    messages: [],
    lastUpdate: new Date().toLocaleDateString(),
    avgResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity
  };
  saveAnalytics();
}

// Save analytics data
function saveAnalytics() {
  localStorage.setItem('chatAnalytics', JSON.stringify(analyticsData));
}

// Enhanced topic detection
function detectTopics(message) {
  const detectedTopics = [];
  const topics = {
    'DSA': /\b(array|linked list|tree|graph|stack|queue|sort|search|hash|heap|trie)\b/i,
    'Algorithms': /\b(algorithm|complexity|big o|time|space|optimize|dynamic programming|recursion|greedy)\b/i,
    'Interview': /\b(interview|question|problem|solution|explain|approach|leetcode|coding challenge)\b/i,
    'WebDev': /\b(javascript|html|css|react|vue|angular|frontend|backend|nodejs|express)\b/i,
    'Database': /\b(sql|database|mongodb|mysql|query|schema|orm)\b/i,
    'Python': /\b(python|jupyter|pandas|numpy|django|flask)\b/i,
    'Java': /\b(java|spring|maven|gradle|oop|class|interface)\b/i,
    'Debugging': /\b(debug|bug|error|exception|fix|trace|breakpoint)\b/i
  };
  
  Object.entries(topics).forEach(([topic, regex]) => {
    if (regex.test(message)) {
      detectedTopics.push(topic);
    }
  });
  
  return detectedTopics.length > 0 ? detectedTopics : ['Other'];
}

// Update analytics when a message is sent
function updateAnalytics(message, responseTime) {
  const timestamp = new Date();
  const hour = timestamp.getHours();
  
  // Update counts
  analyticsData.messagesCount++;
  analyticsData.totalLength += message.length;
  analyticsData.responseTimeTotal += responseTime;
  analyticsData.hourlyData[hour]++;
  
  // Update response time stats
  analyticsData.avgResponseTime = analyticsData.responseTimeTotal / analyticsData.messagesCount;
  analyticsData.maxResponseTime = Math.max(analyticsData.maxResponseTime, responseTime);
  analyticsData.minResponseTime = Math.min(analyticsData.minResponseTime, responseTime);
  
  // Store message details
  analyticsData.messages.push({
    text: message,
    timestamp: timestamp.toISOString(),
    length: message.length,
    responseTime: responseTime,
    hour: hour,
    topics: detectTopics(message)
  });
  
  // Detect and update topics
  const detectedTopics = detectTopics(message);
  detectedTopics.forEach(topic => {
    analyticsData.topics[topic] = (analyticsData.topics[topic] || 0) + 1;
  });
  
  // Limit stored messages to last 100 (for performance)
  if (analyticsData.messages.length > 100) {
    analyticsData.messages.shift();
  }
  
  saveAnalytics();
  updateAnalyticsDisplay();
}

// Update the analytics display with real-time updates
function updateAnalyticsDisplay() {
  // Update stats in sidebar
  const messageCountElements = document.querySelectorAll('.stats-widget .number');
  const messagesCount = analyticsData.messagesCount.toString();
  
  // Update messages today in sidebar
  if (messageCountElements[0]) {
    messageCountElements[0].textContent = messagesCount;
    messageCountElements[0].classList.add('updated');
    setTimeout(() => messageCountElements[0].classList.remove('updated'), 500);
  }

  // Update average length in sidebar
  if (messageCountElements[1]) {
    const avgLength = analyticsData.messagesCount ? 
      Math.round(analyticsData.totalLength / analyticsData.messagesCount) : 0;
    messageCountElements[1].textContent = avgLength;
    messageCountElements[1].classList.add('updated');
    setTimeout(() => messageCountElements[1].classList.remove('updated'), 500);
  }

  // Update analytics cards
  const statValues = document.querySelectorAll('.stat-value');
  if (statValues.length >= 4) {
    // Messages Today
    if (statValues[0]) {
      statValues[0].textContent = messagesCount;
      statValues[0].classList.add('updated');
      setTimeout(() => statValues[0].classList.remove('updated'), 500);
    }
    
    // Average Length
    if (statValues[1]) {
      const avgLength = analyticsData.messagesCount ? 
        Math.round(analyticsData.totalLength / analyticsData.messagesCount) : 0;
      statValues[1].textContent = avgLength + ' chars';
      statValues[1].classList.add('updated');
      setTimeout(() => statValues[1].classList.remove('updated'), 500);
    }
    
    // Response Time
    if (statValues[3]) {
      const avgResponseTime = analyticsData.messagesCount ? 
        (analyticsData.avgResponseTime / 1000).toFixed(2) : '0.00';
      statValues[3].textContent = avgResponseTime + 's';
      statValues[3].classList.add('updated');
      setTimeout(() => statValues[3].classList.remove('updated'), 500);
    }
  }

  // Update history count
  const historyCount = document.querySelector('#historySectionBtn .count');
  const historyList = document.getElementById('historyList');
  if (historyCount && historyList) {
    historyCount.textContent = historyList.children.length;
  }

  // Update topic chart with better handling
  updateTopicChart();
}

// Update or create topic chart
function updateTopicChart() {
  const topicChart = document.getElementById('topicChart');
  if (!topicChart || typeof Chart === 'undefined') return;
  
  const ctx = topicChart.getContext('2d');
  
  // Only create/update if there's data to show
  if (Object.keys(analyticsData.topics).length > 0) {
    const chartData = {
      labels: Object.keys(analyticsData.topics),
      datasets: [{
        data: Object.values(analyticsData.topics),
        backgroundColor: [
          'rgba(76, 201, 240, 0.8)',
          'rgba(67, 97, 238, 0.8)',
          'rgba(58, 12, 163, 0.8)',
          'rgba(114, 9, 183, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(59, 130, 246, 0.8)'
        ],
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 2
      }]
    };
    
    if (chartInstances.topic) {
      // Update existing chart
      chartInstances.topic.data = chartData;
      chartInstances.topic.update('none'); // No animation for smooth updates
    } else {
      // Create new chart
      chartInstances.topic = new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: '#e1e9ff',
                font: { size: 12 },
                padding: 15
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
  }
}

// Initialize the application
function initializeApp() {
  console.log('Initializing application...');

  // Define all UI elements we'll need
  const elements = {
    // Sections
    sections: {
      chat: document.getElementById('chatSection'),
      history: document.getElementById('historySection'),
      analytics: document.getElementById('trendSection'),
      profile: document.getElementById('profileSection')
    },
    // Navigation buttons
    buttons: {
      chat: document.getElementById('chatSectionBtn'),
      history: document.getElementById('historySectionBtn'),
      analytics: document.getElementById('analyticsBtn')
    },
    // Other UI elements
    ui: {
      dashboard: document.querySelector('.dashboard'),
      toggleIcon: document.querySelector('#toggleSidebar i'),
      userAvatar: document.querySelector('.user-menu .avatar'),
      sidebar: document.querySelector('.sidebar'),
      menuToggle: document.getElementById('menuToggle')
    },
    // Chat components
    chat: {
      input: document.getElementById('userInput'),
      sendBtn: document.getElementById('sendBtn'),
      window: document.getElementById('chatWindow'),
      historyList: document.getElementById('historyList')
    }
  };

  // Verify all critical elements exist
  Object.entries(elements).forEach(([category, items]) => {
    Object.entries(items).forEach(([name, element]) => {
      if (!element) {
        console.error(`Missing ${category} element: ${name}`);
      }
    });
  });

  // Setup section navigation
  Object.entries(elements.buttons).forEach(([section, button]) => {
    if (button) {
      button.addEventListener('click', () => {
        console.log(`Clicked ${section} button`);
        const sectionElement = elements.sections[section];
        if (sectionElement) {
          // Remove active class from profile button when switching sections
          if (elements.ui.userAvatar) {
            elements.ui.userAvatar.classList.remove('active');
          }
          const index = Array.from(document.querySelectorAll('main section')).indexOf(sectionElement);
          showSection(index);
        }
      });
    }
  });

  // Setup profile button
  if (elements.ui.userAvatar) {
    elements.ui.userAvatar.addEventListener('click', () => {
      const sections = document.querySelectorAll('main section');
      const profileIndex = Array.from(sections).indexOf(elements.sections.profile);
      if (elements.sections.profile.classList.contains('active')) {
        showSection(0); // Return to chat
      } else {
        showSection(profileIndex);
      }
    });
  }

  // Initialize chat functionality
  if (elements.chat.input && elements.chat.sendBtn) {
    elements.chat.input.addEventListener('keypress', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    elements.chat.sendBtn.addEventListener('click', sendMessage);
  }

  // Initialize other features
  try {
    loadAnalytics();
    initializeSharing();
    updateAnalyticsDisplay();
  } catch (err) {
    console.error('Error initializing features:', err);
  }

  // Restore last active section
  const lastSection = parseInt(localStorage.getItem('currentSection')) || 0;
  showSection(lastSection);

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => console.log('ServiceWorker registered'))
      .catch(err => console.error('ServiceWorker registration failed:', err));
  }

  console.log('Application initialization complete');
}

// Update history empty state
function updateHistoryEmptyState() {
  const historyEmpty = document.getElementById('historyEmpty');
  const historyList = document.getElementById('historyList');
  
  if (historyEmpty && historyList) {
    historyEmpty.style.display = historyList.children.length === 0 ? 'flex' : 'none';
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  updateHistoryEmptyState();
});

// Share functionality
function initializeSharing() {
  const shareBtn = document.getElementById('shareBtn');
  const shareModal = document.getElementById('shareModal');
  const closeShare = document.getElementById('closeShare');
  const qrCode = document.getElementById('qrCode');
  const desktopLink = document.getElementById('desktopLink');
  const mobileLink = document.getElementById('mobileLink');
  const tabletLink = document.getElementById('tabletLink');

  // Get the current URL
  const currentURL = window.location.href;

  // Generate QR code
  QRCode.toCanvas(qrCode, currentURL, {
    width: 200,
    margin: 2,
    color: {
      dark: '#000',
      light: '#fff'
    }
  });

  // Share button click handlers
  shareBtn.addEventListener('click', () => {
    shareModal.classList.add('active');
  });

  closeShare.addEventListener('click', () => {
    shareModal.classList.remove('active');
  });

  // Close modal when clicking outside
  shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) {
      shareModal.classList.remove('active');
    }
  });

  // Device-specific links
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  desktopLink.addEventListener('click', () => copyToClipboard(currentURL));
  mobileLink.addEventListener('click', () => copyToClipboard(currentURL));
  tabletLink.addEventListener('click', () => copyToClipboard(currentURL));

  // Native share if available
  if (navigator.share) {
    shareBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await navigator.share({
          title: 'TechChat - AI Programming Assistant',
          text: 'Check out this awesome AI programming assistant!',
          url: currentURL
        });
      } catch (err) {
        shareModal.classList.add('active');
      }
    });
  }
}


