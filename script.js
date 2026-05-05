// ── CONFIG ────────────────────────────────────────────────────
const AWS_ENDPOINT = "https://your-api-id.execute-api.us-east-1.amazonaws.com/contact";

// ── STATE ─────────────────────────────────────────────────────
let posts = [];
let currentPostId = null;
let lastAISuggestion = "";

// ── CUSTOM CURSOR ─────────────────────────────────────────────
const cursor    = document.getElementById("cursor");
const cursorDot = document.getElementById("cursor-dot");
let mx = 0, my = 0, cx = 0, cy = 0;

document.addEventListener("mousemove", e => { mx = e.clientX; my = e.clientY; });
(function loop() {
  cx += (mx - cx) * 0.14;
  cy += (my - cy) * 0.14;
  cursor.style.left    = cx + "px";
  cursor.style.top     = cy + "px";
  cursorDot.style.left = mx + "px";
  cursorDot.style.top  = my + "px";
  requestAnimationFrame(loop);
})();

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadPosts();
  renderPosts();
  setupWordCount();

  // Ctrl+Enter to publish
  document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key === "Enter") {
      const writePage = document.getElementById("page-write");
      if (writePage && writePage.classList.contains("active")) publishPost();
    }
  });
});

// ── NAVIGATION ────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll(".page").forEach(p => {
    p.classList.remove("active");
    p.style.display = "none";
  });
  const target = document.getElementById("page-" + name);
  if (!target) return;
  target.style.display = "block";
  void target.offsetWidth;
  target.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── STORAGE ───────────────────────────────────────────────────
function loadPosts() {
  try {
    const saved = localStorage.getItem("inkwell_posts_v2");
    posts = saved ? JSON.parse(saved) : [];
  } catch { posts = []; }
}

function savePosts() {
  localStorage.setItem("inkwell_posts_v2", JSON.stringify(posts));
}

// ── RENDER POSTS ──────────────────────────────────────────────
function renderPosts() {
  const list    = document.getElementById("posts-list");
  const countEl = document.getElementById("post-count");
  countEl.textContent = posts.length + " post" + (posts.length !== 1 ? "s" : "");

  if (posts.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-glyph">✦</div>
        <p>No posts yet. Be the first to write something.</p>
        <button class="ghost-btn" onclick="showPage('write')">Write a post →</button>
      </div>`;
    return;
  }

  const reversed = posts.slice().reverse();
  list.innerHTML = reversed.map((p, i) => {
    const excerpt = p.body.slice(0, 180).replace(/\n/g, " ") + (p.body.length > 180 ? "…" : "");
    const date    = new Date(p.date).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
    const num     = String(posts.length - i).padStart(2, "0");
    const tagsHtml = p.tags
      ? p.tags.split(",").map(t => `<span class="tag-pill">${t.trim()}</span>`).join("")
      : "";
    const delay = (i * 0.06).toFixed(2) + "s";
    return `
      <div class="post-card" onclick="openPost('${p.id}')" style="animation-delay:${delay}">
        <div class="card-index">${num}</div>
        <div class="card-content">
          <div class="card-cat">${p.category || "Essay"}</div>
          <div class="card-title">${esc(p.title)}</div>
          <div class="card-excerpt">${esc(excerpt)}</div>
          ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ""}
        </div>
        <div class="card-date">${date}</div>
      </div>`;
  }).join("");
}

// ── OPEN / DELETE POST ────────────────────────────────────────
function openPost(id) {
  const p = posts.find(x => x.id === id);
  if (!p) return;
  currentPostId = id;

  const date = new Date(p.date).toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" });
  document.getElementById("pview-cat").textContent   = (p.category || "Essay").toUpperCase();
  document.getElementById("pview-title").textContent = p.title;
  document.getElementById("pview-meta").textContent  = date + "  ·  " + wordCount(p.body) + " words";
  document.getElementById("pview-body").textContent  = p.body;

  const tagsEl = document.getElementById("pview-tags");
  tagsEl.innerHTML = p.tags
    ? p.tags.split(",").map(t => `<span class="tag-pill">${t.trim()}</span>`).join("")
    : "";

  showPage("post");
}

function deletePost() {
  if (!currentPostId) return;
  if (!confirm("Delete this post? This cannot be undone.")) return;
  posts = posts.filter(p => p.id !== currentPostId);
  savePosts();
  renderPosts();
  showToast("Post deleted.");
  showPage("home");
}

// ── PUBLISH ───────────────────────────────────────────────────
function publishPost() {
  const title = document.getElementById("post-title").value.trim();
  const body  = document.getElementById("post-body").value.trim();
  const tags  = document.getElementById("post-tags").value.trim();
  const cat   = document.getElementById("post-category").value;

  if (!title) { showToast("Add a title first."); return; }
  if (!body)  { showToast("Post body is empty."); return; }

  const post = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title, body, tags, category: cat,
    date: new Date().toISOString()
  };

  posts.push(post);
  savePosts();
  renderPosts();

  document.getElementById("post-title").value = "";
  document.getElementById("post-body").value  = "";
  document.getElementById("post-tags").value  = "";
  document.getElementById("wcount").textContent = "0 words";
  document.getElementById("ai-panel").classList.add("hidden");

  showToast("✦ Published!");
  showPage("home");
}

// ── WORD COUNT ────────────────────────────────────────────────
function setupWordCount() {
  const body = document.getElementById("post-body");
  body.addEventListener("input", () => {
    const w = wordCount(body.value);
    document.getElementById("wcount").textContent = w + " word" + (w !== 1 ? "s" : "");
  });
}

function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

// ── AI PANEL ──────────────────────────────────────────────────
function toggleAI() {
  const panel = document.getElementById("ai-panel");
  panel.classList.toggle("hidden");
}

async function runAI(action) {
  const title = document.getElementById("post-title").value.trim();
  const body  = document.getElementById("post-body").value.trim();

  if (!body && action !== "headline") { showToast("Write something first."); return; }

  const prompts = {
    improve:   `You are a writing editor. Improve the clarity, flow, and style of this blog post. Keep the author's voice intact. Return only the improved text, no preamble.\n\nTitle: ${title}\n\n${body}`,
    expand:    `Expand the following with more depth, examples, and detail. Keep the voice and style consistent. Return only the expanded text.\n\nTitle: ${title}\n\n${body}`,
    summarize: `Write a single compelling paragraph summary of this post. Be concise and engaging.\n\nTitle: ${title}\n\n${body}`,
    headline:  `Suggest exactly 3 punchy, editorial-style blog post titles. Number them 1, 2, 3. Make them specific and memorable.\n\nContent: ${body || title}`
  };

  const out      = document.getElementById("ai-output");
  const applyRow = document.getElementById("ai-apply-row");

  out.innerHTML = `<span style="font-family:var(--f-mono);font-size:0.8rem;color:var(--gold)">Thinking <span class="dot-pulse"><b></b><b></b><b></b></span></span>`;
  applyRow.classList.add("hidden");

  try {
    const res  = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompts[action] }]
      })
    });
    const data = await res.json();
    const text = (data.content || []).map(c => c.text || "").join("") || "No response received.";
    lastAISuggestion = text;
    out.innerHTML = `<div style="white-space:pre-wrap">${esc(text)}</div>`;
    if (action === "improve" || action === "expand") applyRow.classList.remove("hidden");
  } catch (err) {
    out.innerHTML = `<span style="color:var(--red);font-family:var(--f-mono);font-size:0.8rem">Connection error. Check your setup.</span>`;
    console.error(err);
  }
}

function applyAI() {
  if (!lastAISuggestion) return;
  document.getElementById("post-body").value = lastAISuggestion;
  const w = wordCount(lastAISuggestion);
  document.getElementById("wcount").textContent = w + " words";
  document.getElementById("ai-panel").classList.add("hidden");
  showToast("Suggestion applied ✦");
}

// ── CONTACT FORM ──────────────────────────────────────────────
async function submitContact() {
  const name    = document.getElementById("c-name").value.trim();
  const email   = document.getElementById("c-email").value.trim();
  const message = document.getElementById("c-message").value.trim();
  const resp    = document.getElementById("form-resp");

  if (!name || !email || !message) {
    resp.className = "form-resp err";
    resp.textContent = "Please fill in all fields.";
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    resp.className = "form-resp err";
    resp.textContent = "Please enter a valid email address.";
    return;
  }

  resp.className = "form-resp";
  resp.textContent = "Sending…";

  try {
    const res    = await fetch(AWS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message })
    });
    const result = await res.json();
    resp.className = "form-resp ok";
    resp.textContent = result.message || "Message sent — thanks!";
    ["c-name","c-email","c-message"].forEach(id => document.getElementById(id).value = "");
  } catch {
    resp.className = "form-resp ok";
    resp.textContent = "Demo mode active — connect your AWS endpoint to enable real delivery.";
  }
}

// ── TOAST ─────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}

// ── UTILS ─────────────────────────────────────────────────────
function esc(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
