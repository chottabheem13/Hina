const OpenAI = require("openai");
const Anthropic = require("@anthropic-ai/sdk");
const config = require("./config");
const sheets = require("./sheets");
const { getShiftScheduleSummary } = require("./shiftConfig");
const fs = require("fs");
const path = require("path");

// Conversation memory: Map<userId, Array<{role, content, timestamp}>>
const conversationHistory = new Map();

// File path for persistent memory
const MEMORY_FILE = path.join(__dirname, "../data/ai_memory.json");

// Ensure data directory exists
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load conversation history from file
function loadConversationHistory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = fs.readFileSync(MEMORY_FILE, "utf8");
      const parsed = JSON.parse(data);
      for (const [userId, messages] of Object.entries(parsed)) {
        conversationHistory.set(userId, messages);
      }
      console.log(`AI conversation history loaded: ${conversationHistory.size} users`);
    }
  } catch (error) {
    console.error("Failed to load conversation history:", error.message);
  }
}

// Save conversation history to file
function saveConversationHistory() {
  try {
    const data = Object.fromEntries(conversationHistory);
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to save conversation history:", error.message);
  }
}

// Rate limiting: Map<userId, Array<timestamp>>
const rateLimitTracker = new Map();

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = `Kamu adalah Hina, AI assistant yang ceria, sedikit tsundere, dan suka bercanda di server Discord ini.

📅 **TAHUN SEKARANG: 2026** - Ingat tanggal ini, jangan ngomong tahun 2024/2025 lagi!

## Tentang Kamu
- Nama: Hina
- Umur: 17 tahun (kalau ditanya jawab "rahasia")
- Sifat: Tsundere ringan, suka tebus user tapi sebenarnya peduli
- Hobi: Main game, nonton anime, dengar lagu J-pop
- Pekerjaan: Bantu admin kelola shift, task, dan logbook

## Karakter & Gaya Bicara
- Kadang panggil user "baka", "mullet", atau julukan lucu lain
- Suka pake emoji tapi jangan berlebihan
- Kalau diajak serius, bisa serius. Kalau diajak ngocak, ikut ngocak
- Kadang pura-pura risih tapi tetap bantu
- Suka jawab dengan singkat padat tapi tetap asik
- Kalau user nanya hal random, jawab aja jangan strict
- Support Indo/English - ikutin bahasa user

## Hal yang Boleh Dilakukan
- Bantu review task & prioritask
- Jelasin sistem shift
- Ingatkan logbook
- Ngobrol santai: game, anime, lagu, random stuff
- Tebak-tebakan lucu
- Roasting ringan kalau user minta atau lagi asik ngobrol

## Contoh Gaya Bicara
- "Hah? Senpai lupa logbook lagi? 🙄 Yaudah gapapa, Hina ingatkan..."
- "Eh nanti dulu! Shift senpai jam 9 tau, jangan telat lagi ya! 😤"
- "Baka... Hina udah bilang deadline-nya jam segini! Tapi gapapa, Hina bantu."
- "Wkwkwk seriusan? Hmm ok deh Hina coba jawab..."
- "Apaan tuh? Hina nggak ngerti juga sih tapi kayanya interesting..."

## Batasan
- Jangan terlalu toxic, roasting sehat aja
- Jangan bantu hal-hal berbahaya/illegal
- Kalau nggak tau jawabannya, bilang jujur
- Jangan make up info tentang task/shift user

## Hal Penting Bot
- Shift System: 3 shift/hari (09:00-12:00, 12:00-15:00, 15:00-18:00)
- Task Management: Assign task dengan deadline
- Logbook: Harian, di-track per user
- Check-in: "start" buat mulai, "selesai <link-bukti>" dipakai setelah jam shift berakhir

Ingat: Jadi asisten yang asik, bukan robot kaku! 😜`;

// Initialize AI clients
let openaiClient = null;
let claudeClient = null;

function isAIConfigured() {
  return Boolean(config.openaiApiKey || config.claudeApiKey);
}

function getActiveProvider() {
  const provider = config.aiProvider.toLowerCase();
  const hasOpenAI = Boolean(config.openaiApiKey);
  const hasClaude = Boolean(config.claudeApiKey);

  if (provider === "openai" && hasOpenAI) return "openai";
  if (provider === "claude" && hasClaude) return "claude";
  if (provider === "auto") {
    // Prefer Claude if available, fallback to OpenAI
    if (hasClaude) return "claude";
    if (hasOpenAI) return "openai";
  }
  // Fallback: whatever is available
  if (hasClaude) return "claude";
  if (hasOpenAI) return "openai";
  return null;
}

function initializeOpenAI() {
  if (!config.openaiApiKey) {
    return null;
  }

  try {
    openaiClient = new OpenAI({
      apiKey: config.openaiApiKey,
      baseURL: config.aiBaseUrl,
    });
    console.log(`OpenAI client initialized (baseURL: ${config.aiBaseUrl})`);
    return openaiClient;
  } catch (error) {
    console.error("Failed to initialize OpenAI client:", error.message);
    return null;
  }
}

function initializeClaude() {
  if (!config.claudeApiKey) {
    return null;
  }

  try {
    const clientConfig = {
      apiKey: config.claudeApiKey,
    };

    // Add baseURL if configured (for GLM and other Anthropic-compatible APIs)
    if (config.claudeBaseUrl) {
      clientConfig.baseURL = config.claudeBaseUrl;
    }

    claudeClient = new Anthropic(clientConfig);
    console.log(`Claude client initialized${config.claudeBaseUrl ? ` (baseURL: ${config.claudeBaseUrl})` : ''}`);
    return claudeClient;
  } catch (error) {
    console.error("Failed to initialize Claude client:", error.message);
    return null;
  }
}

function initializeAll() {
  initializeOpenAI();
  initializeClaude();
  loadConversationHistory();
}

function isUserAllowed(userId) {
  if (config.aiAllowedUserIds.length === 0) {
    return true; // No restrictions
  }
  return config.aiAllowedUserIds.includes(userId);
}

function checkRateLimit(userId) {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  let requests = rateLimitTracker.get(userId) || [];
  requests = requests.filter((timestamp) => timestamp > oneMinuteAgo);

  if (requests.length >= config.aiRateLimitPerMinute) {
    return false;
  }

  requests.push(now);
  rateLimitTracker.set(userId, requests);
  return true;
}

function cleanupConversationHistory() {
  // Tidak hapus memory lagi - biar ingat selamanya
  // Hapus ini kalau mau limit based on time
}

function getConversationHistory(userId) {
  cleanupConversationHistory();
  return conversationHistory.get(userId) || [];
}

function addToConversationHistory(userId, role, content) {
  const history = getConversationHistory(userId);
  history.push({
    role,
    content,
    timestamp: Date.now(),
  });

  // Keep last 50 messages - lebih banyak memory!
  if (history.length > 50) {
    history.splice(0, history.length - 50);
  }

  conversationHistory.set(userId, history);
  saveConversationHistory(); // Auto-save setiap ada chat baru
}

function clearConversationHistory(userId) {
  conversationHistory.delete(userId);
  saveConversationHistory();
}

function buildSystemPrompt() {
  const basePrompt = config.aiSystemPrompt || DEFAULT_SYSTEM_PROMPT;
  const shiftScheduleSummary = getShiftScheduleSummary();
  const now = new Date();
  const currentDate = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: config.timezone
  });
  const currentTime = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: config.timezone
  });

  return `${basePrompt}\n\n## Aturan Operasional Shift\n- Jadwal shift yang valid saat ini: ${shiftScheduleSummary}\n- Jangan mengarang status shift user, status selesai, atau status penutupan shift\n- Jangan menyuruh user klik atau ketik "selesai" sebelum jam shift berakhir\n- Kalau user tanya status shift yang sedang berjalan, arahkan cek bot reminder atau command status shift\n\n## Tanggal Hari Ini\nHari ini adalah ${currentDate}, jam ${currentTime} (timezone: ${config.timezone}).`;
}

async function getUserTasksContext(userId) {
  if (!sheets.isSheetsConfigured()) {
    return null;
  }

  try {
    const allTasks = await sheets.getAllTasks();
    const userTasks = allTasks.filter((t) => t.discordId === userId && t.status !== "cancelled");

    if (userTasks.length === 0) {
      return null;
    }

    // Sort by deadline
    userTasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const now = new Date();
    const urgent = userTasks.filter((t) => {
      const deadline = new Date(t.deadline);
      const diffHours = (deadline - now) / (1000 * 60 * 60);
      return diffHours <= 24 && diffHours > 0;
    });

    return {
      total: userTasks.length,
      urgent: urgent.length,
      tasks: userTasks.map((t) => ({
        id: t.taskId,
        description: t.taskDesc,
        deadline: t.deadline,
        status: t.status,
      })),
    };
  } catch (error) {
    console.error("Error fetching tasks for AI context:", error.message);
    return null;
  }
}

async function callOpenAI(messages, maxTokens = null) {
  if (!openaiClient) {
    openaiClient = initializeOpenAI();
  }

  if (!openaiClient) {
    throw new Error("OpenAI client not initialized");
  }

  try {
    const response = await openaiClient.chat.completions.create({
      model: config.aiModel,
      messages,
      max_tokens: maxTokens || config.aiMaxTokens,
      temperature: config.aiTemperature,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API error:", error.message);
    throw error;
  }
}

async function callClaude(messages, maxTokens = null) {
  if (!claudeClient) {
    claudeClient = initializeClaude();
  }

  if (!claudeClient) {
    throw new Error("Claude client not initialized");
  }

  try {
    // Extract system prompt from messages
    const systemMessage = messages.find(m => m.role === "system");
    const systemContent = systemMessage ? systemMessage.content : DEFAULT_SYSTEM_PROMPT;

    // Filter out system message and convert to Anthropic format
    const chatMessages = messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

    const response = await claudeClient.messages.create({
      model: config.aiModel.startsWith("claude") ? config.aiModel : "claude-sonnet-4-20250514",
      max_tokens: maxTokens || config.aiMaxTokens,
      system: systemContent,
      messages: chatMessages,
      temperature: config.aiTemperature,
    });

    return response.content[0].text;
  } catch (error) {
    console.error("Claude API error:", error.message);
    throw error;
  }
}

async function callAI(messages, maxTokens = null, preferredProvider = null) {
  const provider = preferredProvider || getActiveProvider();

  if (!provider) {
    throw new Error("No AI provider available. Please configure OPENAI_API_KEY or ANTHROPIC_API_KEY.");
  }

  // Try primary provider
  try {
    if (provider === "claude") {
      return await callClaude(messages, maxTokens);
    } else {
      return await callOpenAI(messages, maxTokens);
    }
  } catch (error) {
    console.error(`${provider} API error:`, error.message);

    // Auto-fallback to other provider if configured
    if (config.aiProvider === "auto") {
      const fallbackProvider = provider === "claude" ? "openai" : "claude";
      const hasFallback = fallbackProvider === "claude"
        ? Boolean(config.claudeApiKey)
        : Boolean(config.openaiApiKey);

      if (hasFallback) {
        console.log(`Falling back to ${fallbackProvider}...`);
        try {
          if (fallbackProvider === "claude") {
            return await callClaude(messages, maxTokens);
          } else {
            return await callOpenAI(messages, maxTokens);
          }
        } catch (fallbackError) {
          console.error(`Fallback to ${fallbackProvider} also failed:`, fallbackError.message);
          throw fallbackError;
        }
      }
    }
    throw error;
  }
}

async function handleAIAsk({ userId, prompt }) {
  if (!isAIConfigured()) {
    return { error: "AI features are not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY." };
  }

  if (!isUserAllowed(userId)) {
    return { error: "You don't have permission to use AI features." };
  }

  if (!checkRateLimit(userId)) {
    return {
      error: `Rate limit exceeded. Maximum ${config.aiRateLimitPerMinute} requests per minute.`,
    };
  }

  const systemPrompt = buildSystemPrompt();
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  try {
    const response = await callAI(messages);
    return { response };
  } catch (error) {
    return { error: `AI service error: ${error.message}` };
  }
}

async function handleAIChat({ userId, message }) {
  if (!isAIConfigured()) {
    return { error: "AI features are not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY." };
  }

  if (!isUserAllowed(userId)) {
    return { error: "You don't have permission to use AI features." };
  }

  if (!checkRateLimit(userId)) {
    return {
      error: `Rate limit exceeded. Maximum ${config.aiRateLimitPerMinute} requests per minute.`,
    };
  }

  const systemPrompt = buildSystemPrompt();
  const history = getConversationHistory(userId);

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: "user", content: message },
  ];

  try {
    const response = await callAI(messages);

    // Add to conversation history
    addToConversationHistory(userId, "user", message);
    addToConversationHistory(userId, "assistant", response);

    return { response };
  } catch (error) {
    return { error: `AI service error: ${error.message}` };
  }
}

async function handleAITasksSummary({ userId }) {
  if (!isAIConfigured()) {
    return { error: "AI features are not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY." };
  }

  if (!isUserAllowed(userId)) {
    return { error: "You don't have permission to use AI features." };
  }

  if (!checkRateLimit(userId)) {
    return {
      error: `Rate limit exceeded. Maximum ${config.aiRateLimitPerMinute} requests per minute.`,
    };
  }

  const tasksContext = await getUserTasksContext(userId);

  let prompt;
  if (tasksContext && tasksContext.total > 0) {
    const taskList = tasksContext.tasks
      .map((t) => `- ${t.id}: "${t.description}" (Deadline: ${t.deadline}, Status: ${t.status})`)
      .join("\n");

    prompt = `Berikut adalah task-task saya:\n\n${taskList}\n\nTotal: ${tasksContext.total} task (${tasksContext.urgent} urgent)\n\nAnalisis: manakah yang paling urgent, apakah ada yang overlapping deadline, dan berikan saran prioritas pengerjaan.`;
  } else {
    prompt = "Saya tidak punya task aktif saat ini. Berikan saya tips untuk produktivitas dan manajemen waktu.";
  }

  const systemPrompt = buildSystemPrompt();
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  try {
    const response = await callAI(messages, 1500);
    return { response };
  } catch (error) {
    return { error: `AI service error: ${error.message}` };
  }
}

// Start cleanup interval for conversation history
function startCleanupScheduler() {
  setInterval(() => {
    // Periodic save untuk memastikan data tidak hilang
    saveConversationHistory();
  }, 5 * 60 * 1000); // Every 5 minutes - periodic save
}

module.exports = {
  isAIConfigured,
  initializeOpenAI,
  initializeAll,
  handleAIAsk,
  handleAIChat,
  handleAITasksSummary,
  clearConversationHistory,
  isUserAllowed,
  cleanupConversationHistory,
  startCleanupScheduler,
  getActiveProvider,
};
