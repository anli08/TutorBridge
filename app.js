const SUPABASE_URL = 'https://ulwojshdhnywcozyxute.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsd29qc2hkaG55d2Nvenl4dXRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NzEzNjgsImV4cCI6MjEwNjQ0NzM2OH0.u75_B2KlsMWF1kh4qOItW9Mw15E0UirfzvWR7t_xsPY';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoiYTI4MiIsImEiOiJjbXV6MmdkY3IwMjMyMnpvajE0Znk4Y2xwIn0.sQQI_zYs3ccqIzg8tcuRNg";

function esc(str){
  return String(str ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

const COORD_DECIMALS = 2;
function roundCoord(v){
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(COORD_DECIMALS) : "";
}

function formatDue(d){
  if (!d) return "No due date";
  const [y, m, day] = String(d).slice(0, 10).split("-").map(Number);
  if (!y) return "No due date";
  return `${m}/${day}/${String(y).slice(2)}`;
}

async function fetchAssignments(userId, isTutor){
  const { data, error } = await supabaseClient
    .from("Assignments")
    .select("*")
    .eq(isTutor ? "tutor_id" : "student_id", userId)
    .order("created_at", { ascending: false });
  if (error){
    console.error(error);
    return [];
  }
  return data || [];
}

async function loadAssignmentSet(assignmentId){
  const { data: a, error } = await supabaseClient
    .from("Assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error || !a){
    console.error(error);
    return null;
  }
  const { data: rows, error: qError } = await supabaseClient
    .from("Assignment Questions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("id", { ascending: true });
  if (qError){
    console.error(qError);
    return null;
  }

  const questions = (rows || []).map(r => {
    if (a.assignment_type === "quizzes"){
      let correct = [];
      try { correct = JSON.parse(r.answer) || []; } catch (e) {}
      return { prompt: r.question, choices: r.choices || [], correct };
    }
    return { front: r.question, back: r.answer };
  });
  return { assignment: a, questions };
}

let _rolePromise = null;

function getType(){
  if (!_rolePromise){
    _rolePromise = (async () => {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user){
        console.error(authError);
        if (authError) alert(authError.message);
        return;
      }
      const { data, error } = await supabaseClient
        .from("User Information")
        .select("type")
        .eq("id", user.id)
        .single();

      if (error){
        console.error(error);
        return;
      }

    return data.type;
    })();
  }
  return _rolePromise;
}

async function updateTutorNav(){

  const link = document.getElementById("my-tutors-link");
  if(!link){
    return;
  }

  const addBtn = document.getElementById("add-to-list-btn"); 

  const type = await getType();
  if(!type){
    return;
  }

  if(type === "tutor"){
    link.textContent = "My Students";
    link.href = "mystudents.html";
    if (addBtn) addBtn.textContent = "Add to My Students";
  }
  else{
    link.textContent = "My Tutors";
    link.href = "mytutors.html";
  }

  link.classList.remove("active");
  highlightActiveNav();
}
// ---- link highlighting ----
function highlightActiveNav(){
  const current = location.pathname.split("/").pop() || "home.html";
  document.querySelectorAll(".nav-links a").forEach(link => {
    const href = link.getAttribute("href");
    if (href === current) link.classList.add("active");
  });
}

// ---- star rating ----

function starString(rating){
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function ratingText(avg, count){
  if (count === undefined || count === null) return "";
  return Number(count) > 0 ? `${Number(avg).toFixed(1)} (${count})` : "No ratings yet";
}

function setProfileStars(avg, count){
  const el = document.getElementById("profile-stars");
  if (!el) return;
  el.innerHTML = `<span class="stars" aria-label="${esc(Number(avg || 0).toFixed(1))} out of 5 stars">${starString(avg)}</span>
    <span class="stars-meta">${esc(ratingText(avg, count))}</span>`;
}

// ---- search/results  ----

function renderTutorRow(t, opts = {}){
  return `
    <div class="row">
      <div class="avatar sm" data-profile-id="${t.id}">${t.initials}</div>
      <div class="row-main">
        <div class="row-name">${t.name}</div>
        <div class="row-meta">${t.subject} · ${t.rate}</div>
        <div class="row-loc">${t.city} — ${t.mode}</div>
      </div>
      <div class="stars-wrap">
        <div class="stars" aria-label="${t.rating} out of 5 stars">${starString(t.rating)}</div>
        ${ratingText(t.rating, t.ratingCount) ? `<div class="stars-meta">${esc(ratingText(t.rating, t.ratingCount))}</div>` : ""}
      </div>
      <a class="btn btn-sm" href="messages.html?id=${t.id}">Message</a>
    </div>`;
    
}

function renderResults(list, targetId){
  const el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = list.length
    ? list.map(t => renderTutorRow(t)).join("")
    : `<div class="empty-state"><p><strong>No tutors match yet.</strong><br>Try widening your subject or distance.</p></div>`;
}

async function wireSearchPage(){
  const list = document.getElementById("results-list");
  if (!list) return;
  const dataset = await fetchOppositeUsers();
  renderResults(dataset, "results-list");

  const subjectSel = document.getElementById("filter-subject");
  const sortSel = document.getElementById("filter-sort");
  const modeSel = document.getElementById("filter-mode");

  function apply(){
    let results = [...dataset];
    if (subjectSel && subjectSel.value !== "all"){
      results = results.filter(t => t.subject.toLowerCase().includes(subjectSel.value));
    }
    if (modeSel && modeSel.value !== "all"){
      results = results.filter(t => t.mode.toLowerCase().includes(modeSel.value));
    }
    if (sortSel){
      if (sortSel.value === "rating") results.sort((a,b) => b.rating - a.rating);
      if (sortSel.value === "price")  results.sort((a,b) => parseInt(a.rate.replace(/\D/g,"")) - parseInt(b.rate.replace(/\D/g,"")));
    }
    renderResults(results, "results-list");
  }

  [subjectSel, sortSel, modeSel].forEach(el => el && el.addEventListener("change", apply));
}

function toRow(p){
  const name = p.name || "Unnamed";
  return {
    id: p.id,
    name,
    initials: name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
    subject: p.subjects ? p.subjects.split(",").join(", ") : "",
    rate:    p.rate    || "",
    city:    p.city    || "",
    mode:    p.mode    || "",
    rating:  Number(p.rating_avg) || 0,       
    ratingCount: Number(p.rating_count) || 0,
    lat:     parseFloat(p.latitude),  
    lng:     parseFloat(p.longitude)
  };
}

async function fetchOppositeUsers(limit){
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return [];
  const myType = await getType();
  const wanted = myType === "tutor" ? "student" : "tutor";

  let query = supabaseClient
    .from("User Information")
    .select("*")
    .eq("type", wanted)
    .neq("id", user.id);
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error){
    console.error(error);
    return [];
  }
  return data.map(toRow);
}

// ---- recommended ----
function parseSubjects(str){
  return (str || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
}

async function renderRecommended(targetId, limit = 4){
  const el = document.getElementById(targetId);
  if (!el) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const myType = await getType();
  const wanted = myType === "tutor" ? "student" : "tutor";
  const label  = wanted === "tutor" ? "tutors" : "students";

  const { data: me, error: meError } = await supabaseClient
    .from("User Information")
    .select("subjects, mode, rate")
    .eq("id", user.id)
    .maybeSingle();
  if (meError) console.error(meError);

  const { data: candidates, error } = await supabaseClient
    .from("User Information")
    .select("*")
    .eq("type", wanted)
    .neq("id", user.id);
  if (error){
    console.error(error);
    el.innerHTML = `<div class="empty-state"><p><strong>Couldn't load recommendations.</strong></p></div>`;
    return;
  }

  const mySubjects = parseSubjects(me && me.subjects);
  const myMode = me && me.mode ? String(me.mode).toLowerCase() : "";
  const myRate = me ? parseFloat(me.rate) : NaN;

  const scored = [];
  for (const c of candidates){
    const shared = parseSubjects(c.subjects).filter(s => mySubjects.includes(s)).length;
    if (mySubjects.length && shared === 0) continue;

    if (myMode && c.mode && String(c.mode).toLowerCase() !== myMode) continue;

    const theirRate = parseFloat(c.rate);
    if (!isNaN(myRate) && !isNaN(theirRate)){
      const ok = myType === "tutor" ? theirRate >= myRate : theirRate <= myRate;
      if (!ok) continue;
    }
    scored.push({ c, shared });
  }
  scored.sort((a, b) => b.shared - a.shared);

  if (scored.length){
    el.innerHTML = scored.slice(0, limit).map(x => renderTutorRow(toRow(x.c))).join("");
    return;
  }

  if (!candidates.length){
    el.innerHTML = `<div class="empty-state"><p><strong>No ${label} yet.</strong></p></div>`;
    return;
  }

  el.innerHTML =
    `<div class="empty-state"><p>No ${label} match your preferences. Other ${label}:</p></div>` +
    candidates.slice(0, limit).map(c => renderTutorRow(toRow(c))).join("");
}

async function wireHomeFeed(){
  const list = document.getElementById("recommended-list");
  if (!list) return;
  const profileName = document.getElementById("profile-name");
  if(!profileName){
    return;
  }
  const profileDescription = document.getElementById("home-page-description");
  if(!profileDescription){
    return;
  }
  const {data: {user}, error: userError} = await supabaseClient.auth.getUser();
  if(userError){
    console.error(userError);
    return;
  }

  const {data, error} = await supabaseClient
    .from("User Information")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if(error){
    console.log(error.message);
    return;
  }
  profileName.textContent = data.name;
  profileDescription.textContent = data.profile_description;
  setProfileStars(data.rating_avg, data.rating_count);

  await renderRecommended("recommended-list", 4);
}

// ---- messages ----

function formatMsgTime(iso){
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const now = new Date();
  const startOfDay = x => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days === 0) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

async function wireMessagesPage(){
  const listEl = document.getElementById("conversation-list");
  if (!listEl) return;
  const head = document.getElementById("thread-head");
  const body = document.getElementById("thread-body");
  const form = document.getElementById("compose-form");
  const input = document.getElementById("compose-input");

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user){
    window.location.href = "login.html";
    return;
  }

  const convos = new Map();
  let activeId = null;

  const initialsOf = name => (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  async function ensureConvo(otherId){
    if (convos.has(otherId)) return convos.get(otherId);
    const { data: p, error } = await supabaseClient
      .from("User Information")
      .select("id, name")
      .eq("id", otherId)
      .maybeSingle();
    if (error) console.error(error);
    const name = (p && p.name) || "Unnamed";
    const c = { id: otherId, name, initials: initialsOf(name), messages: [] };
    convos.set(otherId, c);
    return c;
  }

  function addMessage(row){
    const otherId = row.sender_id === user.id ? row.reciever_id : row.sender_id;
    const c = convos.get(otherId);
    if (!c || c.messages.some(m => m.id === row.id)) return;
    c.messages.push({ id: row.id, from: row.sender_id === user.id ? "me" : "them", text: row.message, sentAt: row.time_sent });
  }

  const lastTime = c => c.messages.length ? new Date(c.messages[c.messages.length - 1].sentAt).getTime() : Infinity;

  function renderList(){
    const items = [...convos.values()].sort((a, b) => lastTime(b) - lastTime(a));
    if (!items.length){
      listEl.innerHTML = `<div class="empty-state"><p><strong>No conversations yet</strong><br>Message someone from their profile.</p></div>`;
      return;
    }
    listEl.innerHTML = items.map(c => {
      const last = c.messages[c.messages.length - 1];
      return `
      <div class="thread-item ${c.id === activeId ? "active" : ""}" data-id="${esc(c.id)}">
        <div class="avatar sm" data-profile-id="${esc(c.id)}">${esc(c.initials)}</div>
        <div class="row-main">
          <div class="row-name">${esc(c.name)}</div>
          <div class="row-meta">${last ? esc(last.text) : "No messages yet"}</div>
        </div>
      </div>`;
    }).join("");
    listEl.querySelectorAll(".thread-item").forEach(item => {
      item.addEventListener("click", () => select(item.dataset.id));
    });
  }

  function renderThread(){
    const c = convos.get(activeId);
    if (!c){
      head.innerHTML = "";
      body.innerHTML = `<div class="empty-state"><p><strong>Select a conversation</strong><br>Pick someone from the list to see messages.</p></div>`;
      form.style.display = "none";
      return;
    }
    form.style.display = "flex";
    head.innerHTML = `<div class="avatar sm" data-profile-id="${esc(c.id)}">${esc(c.initials)}</div><div class="row-name">${esc(c.name)}</div>`;
    body.innerHTML = c.messages.length
      ? c.messages.map(m => `
      <div class="bubble ${m.from === "me" ? "me" : "them"}">
        ${esc(m.text)}
        <div class="bubble-time">${esc(formatMsgTime(m.sentAt))}</div>
      </div>`).join("")
      : `<div class="empty-state"><p>No messages yet. Say hi!</p></div>`;
    body.scrollTop = body.scrollHeight;
  }

  function select(id){
    activeId = id;
    renderList();
    renderThread();
  }

  const { data: rows, error: loadError } = await supabaseClient
    .from("Messages")
    .select("id, sender_id, reciever_id, message, time_sent")
    .or(`sender_id.eq.${user.id},reciever_id.eq.${user.id}`)
    .order("time_sent", { ascending: true });
  if (loadError){
    console.error(loadError);
    listEl.innerHTML = `<div class="empty-state"><p><strong>Couldn't load messages.</strong></p></div>`;
    return;
  }

  const otherIds = [...new Set(rows.map(r => r.sender_id === user.id ? r.reciever_id : r.sender_id))];
  const targetId = new URLSearchParams(window.location.search).get("id");
  if (targetId && targetId !== user.id && !otherIds.includes(targetId)) otherIds.push(targetId);

  if (otherIds.length){
    const { data: people, error: peopleError } = await supabaseClient
      .from("User Information")
      .select("id, name")
      .in("id", otherIds);
    if (peopleError) console.error(peopleError);
    const byId = new Map((people || []).map(p => [p.id, p]));
    otherIds.forEach(id => {
      const name = (byId.get(id) && byId.get(id).name) || "Unnamed";
      convos.set(id, { id, name, initials: initialsOf(name), messages: [] });
    });
  }
  rows.forEach(addMessage);

  const sorted = [...convos.values()].sort((a, b) => lastTime(b) - lastTime(a));
  activeId = (targetId && convos.has(targetId)) ? targetId : (sorted[0] && sorted[0].id) || null;
  renderList();
  renderThread();

  // ---- send ----
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !activeId) return;

    const { data: inserted, error } = await supabaseClient
      .from("Messages")
      .insert({ sender_id: user.id, reciever_id: activeId, message: text })
      .select("id, sender_id, reciever_id, message, time_sent")
      .single();

    if (error){
      console.error(error);
      alert(error.message);
      return;
    }
    addMessage(inserted);
    input.value = "";
    renderList();
    renderThread();
  });

  supabaseClient
    .channel("messages-" + user.id)
    .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "Messages", filter: `reciever_id=eq.${user.id}` },
        async (payload) => {
          await ensureConvo(payload.new.sender_id);
          addMessage(payload.new);
          renderList();
          if (activeId === payload.new.sender_id) renderThread();
        })
    .subscribe();
}

let resolveRoster;
const rosterReady = new Promise(res => { resolveRoster = res; });

async function wireMyTutorsPage(){
  const listEl = document.getElementById("mytutors-list");
  if (!listEl) return;

  const role = await getType();
  if(!role){
    resolveRoster([]);
    return;
  }

  const {data: {user}} = await supabaseClient.auth.getUser();
  const isTutor = role === "tutor";
  const otherCol = isTutor ? "student_id" : "tutor_id";

  async function loadRoster(){
    const myCol = isTutor ? "tutor_id" : "student_id";

    const {data: links} = await supabaseClient
      .from("Tutor Student Connections")
      .select(otherCol)
      .eq(myCol, user.id)
    if (!links?.length) return [];

    const {data: people} = await supabaseClient
      .from("User Information")
      .select("*")
      .in("id", links.map(l => l[otherCol]));

    return (people || []).map(toRow);
  }

  const [data, assignments] = await Promise.all([
    loadRoster(),
    fetchAssignments(user.id, isTutor)
  ]);
  resolveRoster(data);

  function renderList(activeId){
    if (!data.length){
      listEl.innerHTML = `<div class="empty-state"><p><strong>No ${isTutor ? "students" : "tutors"} yet</strong><br>Add someone from their profile.</p></div>`;
      return;
    }
    listEl.innerHTML = data.map(t => `
      <div class="thread-item ${t.id === activeId ? "active" : ""}" data-id="${esc(t.id)}">
        <div class="avatar sm">${esc(t.initials)}</div>
        <div class="row-main">
          <div class="row-name">${esc(t.name)}</div>
          <div class="row-meta">${esc(t.subject)}</div>
        </div>
      </div>`).join("");

    listEl.querySelectorAll(".thread-item").forEach(item => {
      item.addEventListener("click", () => {
        const id = item.dataset.id;
        renderList(id);
        renderHW(data.find(t => t.id === id));
      });
    });
  }

  function renderHW(t){
    const body = document.getElementById("mytutors-homework");
    if (!t){
      body.innerHTML = `<div class="empty-state"><p><strong>Select a ${isTutor ? "student" : "tutor"}</strong><br>${isTutor ? "Manage their assignments here." : "See homework here."}</p></div>`;
      return;
    }

    const mine = assignments.filter(a => a[otherCol] === t.id);
    const flashcards = mine.filter(a => a.assignment_type === "flashcards");
    const quizzes = mine.filter(a => a.assignment_type === "quizzes");
    const actionLabel = isTutor ? "View" : "Start";

    const flashRows = flashcards.length
      ? flashcards.map(f => `
        <div class="hw-row">
          <div class="hw-row-title">${esc(f.assignment_name)}</div>
          <div class="hw-row-meta">Due ${esc(formatDue(f.due_date))}</div>
          <a class="btn btn-sm btn-pill" href="flashcards.html?assignment=${encodeURIComponent(f.id)}">${actionLabel}</a>
        </div>`).join("")
      : `<div class="hw-empty">No flashcards assigned yet.</div>`;

    const quizRows = quizzes.length
      ? quizzes.map(q => {
          const saved = localStorage.getItem(`tb_quiz_score_${q.id}`);
          const scoreHtml = isTutor ? "" : `<div class="hw-row-score">Score: ${saved !== null ? esc(saved) : ""}/${esc(q.num_questions)}</div>`;
          return `
        <div class="hw-row">
          <div class="hw-row-title">${esc(q.assignment_name)}</div>
          ${scoreHtml}
          <div class="hw-row-meta">Due ${esc(formatDue(q.due_date))}</div>
          <a class="btn btn-sm btn-pill" href="quiz.html?assignment=${encodeURIComponent(q.id)}">${actionLabel}</a>
        </div>`;
        }).join("")
      : `<div class="hw-empty">No quizzes assigned yet.</div>`;

    body.innerHTML = `
      <div class="hw-panel">
        <div class="hw-panel-head">${isTutor ? "Assignments" : "Homework"}</div>
        <div class="hw-section">
          <div class="hw-section-title">Flashcards</div>
          ${flashRows}
        </div>
        <div class="hw-section">
          <div class="hw-section-title">Quizzes</div>
          ${quizRows}
        </div>
        <div class="hw-panel-foot">
          <a class="btn btn-primary" href="messages.html?id=${encodeURIComponent(t.id)}">Message ${esc(t.name.split(" ")[0])}</a>
          ${isTutor ? `<a class="btn" href="assign-homework.html?id=${encodeURIComponent(t.id)}">Assign Homework</a>` : ""}
        </div>
      </div>`;
  }

  renderList(data[0]?.id);
  renderHW(data[0]);
}

async function loadProfile(){
  const nameEl = document.getElementById("profile-name");
  if (!nameEl) return;

  let id = new URLSearchParams(window.location.search).get("id");
  if (!id){
    return;
  }

  const { data: p, error } = await supabaseClient
    .from("User Information")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !p){
    console.error(error);
    return;
  }

  const setText = (elId, value) => {
    const el = document.getElementById(elId);
    if (el) el.textContent = value || "";
  };
  const name = p.name || "Unnamed";
  document.title = `${name} · TutorBridge`;
  setText("profile-name", name);
  setText("profile-avatar", name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase());

  const isTutor = p.type === "tutor";
  isTutor ? setText("displayed-subject", "Subjects Tutored") : setText("displayed-subject", "Interested Subjects");
  setText("profile-subject", p.subjects);
  isTutor ? setText("displayed-rate", "Rate") : setText("displayed-rate", "Prefered Rate");
  setText("profile-rate", "$" + p.rate);
  isTutor ? setText("displayed-mode", "Mode") : setText("displayed-mode", "Prefered Mode");
  setText("profile-mode", p.mode);
  setProfileStars(p.rating_avg, p.rating_count);

  const msgBtn = document.getElementById("message-btn");
  if (msgBtn) msgBtn.href = `messages.html?id=${encodeURIComponent(p.id)}`;
}

async function wireRatingForm(otherId){
  const form = document.getElementById("rating-form");
  if (!form) return;
  const select = document.getElementById("user-rating");
  const submit = document.getElementById("rating-submit");
  const status = document.getElementById("rating-status");
  const setStatus = (text, isError) => {
    status.textContent = text;
    status.classList.toggle("is-error", !!isError);
  };

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  if (user.id === otherId){ 
    form.style.display = "none";
    return;
  }

  const { data: links, error: linkError } = await supabaseClient
    .from("Tutor Student Connections")
    .select("tutor_id")
    .or(`and(tutor_id.eq.${user.id},student_id.eq.${otherId}),and(student_id.eq.${user.id},tutor_id.eq.${otherId})`)
    .limit(1);

  if (linkError){
    console.error(linkError);
    select.disabled = true;
    submit.disabled = true;
    setStatus("Couldn't check your connection: " + linkError.message, true);
    return;
  }

  if (!links || !links.length){
    const myType = await getType();
    select.disabled = true;
    submit.disabled = true;
    setStatus(`You can rate this user once they're in your ${myType === "tutor" ? "My Students" : myType === "student" ? "My Tutors" : "My Tutors / My Students"} list.`);
    return;
  }

  const { data: mine } = await supabaseClient
    .from("User Ratings")
    .select("rating")
    .eq("rater_id", user.id)
    .eq("rated_id", otherId)
    .maybeSingle();
  if (mine){
    select.value = String(mine.rating);
    submit.textContent = "Update";
    setStatus(`You rated this user ${mine.rating}/5. You can change it any time.`);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const rating = parseInt(select.value, 10);
    if (!rating){
      setStatus("Pick a rating from 1 to 5.", true);
      return;
    }
    submit.disabled = true;
    const { error } = await supabaseClient
      .from("User Ratings")
      .upsert(
        { rater_id: user.id, rated_id: otherId, rating, updated_at: new Date().toISOString() },
        { onConflict: "rater_id,rated_id" }
      );
    submit.disabled = false;
    if (error){
      console.error(error);
      setStatus(`Couldn't save your rating: ${error.message}${error.code ? ` (${error.code})` : ""}`, true);
      return;
    }
    submit.textContent = "Update";
    setStatus(`Saved. You rated this user ${rating}/5.`);

    const { data: fresh } = await supabaseClient
      .from("User Information")
      .select("rating_avg, rating_count")
      .eq("id", otherId)
      .maybeSingle();
    if (fresh) setProfileStars(fresh.rating_avg, fresh.rating_count);
  });
}

async function wireProfilePage(){
  loadProfile();
  wireRatingForm(new URLSearchParams(window.location.search).get("id"));
  const otherId = new URLSearchParams(window.location.search).get("id");
  const msgLink = document.getElementById("message-btn");
  if (msgLink && otherId) msgLink.href = `messages.html?id=${encodeURIComponent(otherId)}`;
  if (!otherId){
    return;
  }

  await renderRecommended("recommended-list", 4);

  const addBtn = document.getElementById("add-to-list-btn");
  if (!addBtn) return;

  addBtn.addEventListener("click", async (event) => {
    event.preventDefault();

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user){
      console.error(userError);
      alert(userError ? userError.message : "Please log in again.");
      return;
    }

    const type = await getType();
    const row = type === "tutor"
      ? { tutor_id: user.id, student_id: otherId }
      : { student_id: user.id, tutor_id: otherId };

    const { error: addError } = await supabaseClient
      .from("Tutor Student Connections")
      .insert(row);

    if (addError){
      console.error(addError);
      alert(addError.code === "23505" ? "Already in your list." : addError.message);
      return;
    }

    window.location.href = type === "tutor" ? "mystudents.html" : "mytutors.html";
  });
}

// ---- assign homework ----

async function wireAssignHomeworkPage(){
  const listEl = document.getElementById("assign-student-list");
  if (!listEl) return;
  const body = document.getElementById("assign-body");

  const studentId = new URLSearchParams(location.search).get("id");
  const {data: {user}} = await supabaseClient.auth.getUser();
  if (!user){
    window.location.href = "login.html";
    return;
  }
  if (!studentId){
    window.location.href = "mystudents.html";
    return;
  }

  const {data: link} = await supabaseClient
    .from("Tutor Student Connections")
    .select("student_id")
    .eq("tutor_id", user.id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!link){
    window.location.href = "mystudents.html";
    return;
  }

  const {data: p, error: pError} = await supabaseClient
    .from("User Information")
    .select("*")
    .eq("id", studentId)
    .single();
  if (pError || !p){
    console.error(pError);
    window.location.href = "mystudents.html";
    return;
  }
  const student = toRow(p);

  const backLink = document.querySelector(".assign-back");
  if (backLink) backLink.setAttribute("href", "mystudents.html");

  function assignedListHtml(rows){
    const section = (title, list, emptyText) => `
      <div class="hw-section">
        <div class="hw-section-title">${title}</div>
        ${list.length
          ? list.map(a => `
        <div class="hw-row">
          <div class="hw-row-title">${esc(a.assignment_name)}</div>
          <div class="hw-row-meta">${esc(a.num_questions)} questions · Due ${esc(formatDue(a.due_date))}</div>
        </div>`).join("")
          : `<div class="hw-empty">${emptyText}</div>`}
      </div>`;
    return section("Flashcards", rows.filter(a => a.assignment_type === "flashcards"), "No flashcards assigned yet.")
         + section("Quizzes",    rows.filter(a => a.assignment_type === "quizzes"),    "No quizzes assigned yet.");
  }

  body.innerHTML = `
    <div class="hw-panel">
      <div class="hw-panel-head">Assign to ${esc(student.name)}</div>

      <form id="assign-form" class="assign-form">
        <div class="field">
          <label for="assign-type">Type</label>
          <select id="assign-type">
            <option value="flashcards">Flashcards</option>
            <option value="quizzes">Quiz</option>
          </select>
        </div>
        <div class="field">
          <label for="assign-name">Assignment Name</label>
          <input type="text" id="assign-name" required>
        </div>
        <div class="field">
          <label for="assign-number"># of Questions</label>
          <input type="number" id="assign-number" min="1" max="50" value="1" required>
        </div>
        <div class="field">
          <label for="assign-due">Due date</label>
          <input type="date" id="assign-due" required>
        </div>
        <a class="btn btn-primary" style="width: 900px;" id="assign-create-link" href="question-create.html">Create Questions</a>
      </form>

      <div class="hw-panel-head assign-current-head">Currently Assigned</div>
      <div id="assign-current"><div class="hw-empty">Loading…</div></div>
    </div>`;

  document.getElementById("assign-create-link").addEventListener("click", (event) => {
    event.preventDefault();
    const form = document.getElementById("assign-form");
    if (!form.reportValidity()) return;

    const q = new URLSearchParams({
      id: student.id,
      type: document.getElementById("assign-type").value,
      name: document.getElementById("assign-name").value.trim(),
      count: document.getElementById("assign-number").value,
      due: document.getElementById("assign-due").value,
    });
    window.location.href = `question-create.html?${q}`;
  });

  const {data: rows, error: rowsError} = await supabaseClient
    .from("Assignments")
    .select("*")
    .eq("tutor_id", user.id)
    .eq("student_id", student.id)
    .order("created_at", { ascending: false });
  const currentEl = document.getElementById("assign-current");
  if (rowsError){
    console.error(rowsError);
    currentEl.innerHTML = `<div class="hw-empty">Couldn't load assignments.</div>`;
    return;
  }
  currentEl.innerHTML = assignedListHtml(rows || []);
}

async function wireCreatePage(){
  const body = document.getElementById("create-body");
  if (!body) return;

  const params = new URLSearchParams(location.search);
  const studentId = params.get("id");
  const type = params.get("type") === "quizzes" ? "quizzes" : "flashcards";
  const name = (params.get("name") || "").trim();
  const dueRaw = params.get("due") || "";
  const count = Math.min(Math.max(parseInt(params.get("count"), 10) || 0, 0), 50);

  const {data: {user}} = await supabaseClient.auth.getUser();
  if (!user){
    window.location.href = "login.html";
    return;
  }

  if (!studentId || !name || !dueRaw || !count){
    window.location.replace(studentId ? `assign-homework.html?id=${encodeURIComponent(studentId)}` : "mystudents.html");
    return;
  }

  const {data: student, error: studentError} = await supabaseClient
    .from("User Information")
    .select("id, name")
    .eq("id", studentId)
    .maybeSingle();
  if (studentError || !student){
    console.error(studentError);
    window.location.replace("mystudents.html");
    return;
  }

  const backLink = document.querySelector(".assign-back");
  if (backLink) backLink.setAttribute("href", `assign-homework.html?id=${encodeURIComponent(studentId)}`);

  const qs = Array.from({ length: count }, () => ({ prompt: "", answer: "", choices: ["", "", "", ""], correct: [] }));

  function questionHtml(q, i){
    const answerHtml = type === "quizzes"
      ? `<div class="create-choices">
          ${q.choices.map((c, j) => `
            <div class="create-choice">
              <input type="checkbox" class="create-correct" data-q="${i}" data-c="${j}" aria-label="Choice ${j + 1} is correct" ${q.correct.includes(j) ? "checked" : ""}>
              <input type="text" class="create-choice-text" data-q="${i}" data-c="${j}" placeholder="Choice ${j + 1}" autocomplete="off" value="${esc(c)}">
            </div>`).join("")}
        </div>
        <div class="field-hint">Check every choice that is correct. Leave unused choices blank.</div>`
      : `<div class="field">
          <label for="create-a-${i}">Answer</label>
          <textarea id="create-a-${i}" class="create-answer" data-q="${i}" placeholder="Back of the card…">${esc(q.answer)}</textarea>
        </div>`;

    return `
      <div class="create-q">
        <div class="create-q-head"><span class="create-q-title">Question ${i + 1}</span></div>
        <div class="field">
          <textarea class="create-prompt" data-q="${i}" placeholder="${type === "quizzes" ? "Type your question…" : "Front of the card…"}" aria-label="Question ${i + 1}">${esc(q.prompt)}</textarea>
        </div>
        ${answerHtml}
      </div>`;
  }

  body.innerHTML = `
    <div class="hw-panel">
      <div class="hw-panel-head">Create for ${esc(student.name || "Unnamed")}</div>

      <div class="ai-box">
        <div class="ai-box-title">Short on time? Let AI draft the ${type === "quizzes" ? "quiz questions" : "flashcards"}.</div>
        <div class="ai-row">
          <input type="text" id="ai-topic" maxlength="200" autocomplete="off"
                 placeholder="What should they cover? e.g. quadratic equations, 10th grade" aria-label="Topic for AI-generated questions">
          <button type="button" class="btn" id="ai-generate-btn">Use AI to generate questions</button>
        </div>
        <p class="field-hint ai-status" id="ai-status" role="status" aria-live="polite">
          AI drafts can contain mistakes. Check every question and answer before assigning. Only the topic and assignment name are sent.
        </p>
      </div>

      <form id="create-form" class="assign-form create-form" novalidate>
        <div id="create-questions">${qs.map(questionHtml).join("")}</div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 6px;">Assign</button>
        <span id="create-note" class="assign-note"></span>
      </form>
    </div>`;

  const form = document.getElementById("create-form");
  const listEl = document.getElementById("create-questions");
  const note = document.getElementById("create-note");

  listEl.addEventListener("input", e => {
    const t = e.target;
    const i = parseInt(t.dataset.q, 10);
    if (Number.isNaN(i)) return;
    if (t.classList.contains("create-prompt")) qs[i].prompt = t.value;
    else if (t.classList.contains("create-answer")) qs[i].answer = t.value;
    else if (t.classList.contains("create-choice-text")) qs[i].choices[parseInt(t.dataset.c, 10)] = t.value;
  });

  listEl.addEventListener("change", e => {
    const t = e.target;
    if (!t.classList.contains("create-correct")) return;
    const i = parseInt(t.dataset.q, 10);
    const j = parseInt(t.dataset.c, 10);
    const set = new Set(qs[i].correct);
    if (t.checked) set.add(j); else set.delete(j);
    qs[i].correct = [...set];
  });

  let noteTimer;
  function showNote(text, isError){
    note.textContent = text;
    note.classList.toggle("is-error", !!isError);
    note.classList.add("is-visible");
    clearTimeout(noteTimer);
    if (isError) noteTimer = setTimeout(() => note.classList.remove("is-visible"), 3500);
  }

  // ---- AI-generated questions ----
  const aiBtn = document.getElementById("ai-generate-btn");
  const aiTopic = document.getElementById("ai-topic");
  const aiStatus = document.getElementById("ai-status");
  const AI_BATCH = 15;

  function setAiStatus(text, isError){
    aiStatus.textContent = text;
    aiStatus.classList.toggle("is-error", !!isError);
  }

  const hasContent = () => qs.some(q => q.prompt.trim() || q.answer.trim() || q.choices.some(c => c.trim()));

  function applyGenerated(items, offset){
    items.forEach((g, k) => {
      const q = qs[offset + k];
      if (!q) return;
      if (type === "quizzes"){
        const choices = Array.isArray(g.choices) ? g.choices.map(c => String(c ?? "")).slice(0, 4) : [];
        q.prompt = String(g.prompt ?? "");
        q.choices = [...choices, "", "", "", ""].slice(0, 4);
        q.correct = (Array.isArray(g.correct) ? g.correct : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < 4);
        q.answer = "";
      } else {
        q.prompt = String(g.front ?? "");
        q.answer = String(g.back ?? "");
      }
    });
    listEl.innerHTML = qs.map(questionHtml).join("");
  }

  async function aiErrorMessage(error){
    try {
      const body = await error.context.json();
      if (body && body.error) return body.error;
    } catch (e) {}
    return error.message || "Couldn't reach the AI service.";
  }

  aiBtn.addEventListener("click", async () => {
    const topic = aiTopic.value.trim();
    if (!topic){
      setAiStatus("Tell the AI what the questions should cover first.", true);
      aiTopic.focus();
      return;
    }
    if (hasContent() && !confirm("This will replace the questions you've already written. Continue?")) return;

    aiBtn.disabled = true;
    aiTopic.disabled = true;
    qs.forEach(q => { q.prompt = ""; q.answer = ""; q.choices = ["", "", "", ""]; q.correct = []; });
    listEl.innerHTML = qs.map(questionHtml).join("");

    let done = 0;
    try {
      while (done < qs.length){
        const want = Math.min(AI_BATCH, qs.length - done);
        setAiStatus(`Generating questions ${done + 1}–${done + want} of ${qs.length}…`);
        const existing = qs.slice(0, done).map(q => q.prompt.slice(0, 200));
        const { data, error } = await supabaseClient.functions.invoke("generate-questions", {
          body: { topic, type, count: want, assignmentName: name, existing }
        });
        if (error) throw new Error(await aiErrorMessage(error));
        const items = Array.isArray(data && data.questions) ? data.questions : [];
        if (!items.length) throw new Error("The AI didn't return any usable questions. Please try again.");
        const used = items.slice(0, want);
        applyGenerated(used, done);
        done += used.length;
      }
      setAiStatus(`Done: ${done} ${type === "quizzes" ? "questions" : "flashcards"} drafted. Review and edit them before assigning.`);
    } catch (err) {
      console.error(err);
      setAiStatus(done
        ? `${err.message} (${done} of ${qs.length} were drafted; fill in the rest yourself or try again.)`
        : err.message, true);
    } finally {
      aiBtn.disabled = false;
      aiTopic.disabled = false;
    }
  });

  function validate(){
    for (let i = 0; i < qs.length; i++){
      const q = qs[i];
      if (!q.prompt.trim()) return `Question ${i + 1} is empty.`;
      if (type === "flashcards"){
        if (!q.answer.trim()) return `Question ${i + 1} needs an answer.`;
      } else {
        const filled = q.choices.map((c, j) => ({ c: c.trim(), j })).filter(x => x.c);
        if (filled.length < 2) return `Question ${i + 1} needs at least two choices.`;
        if (!filled.some(x => q.correct.includes(x.j))) return `Question ${i + 1} needs a correct answer checked.`;
      }
    }
    return "";
  }

  const setDisabled = flag => form.querySelectorAll("button, input, textarea").forEach(el => { el.disabled = flag; });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const error = validate();
    if (error){ showNote(error, true); return; }

    setDisabled(true);
    showNote("Assigning…", false);

    const { data: assignment, error: aError } = await supabaseClient
      .from("Assignments")
      .insert({
        assignment_name: name,
        assignment_type: type,
        num_questions: qs.length,
        student_id: student.id,
        tutor_id: user.id,
        due_date: dueRaw
      })
      .select("id")
      .single();
    if (aError){
      console.error(aError);
      showNote(aError.message, true);
      setDisabled(false);
      return;
    }

    const rows = qs.map(q => {
      if (type === "quizzes"){
        const kept = q.choices
          .map((c, j) => ({ text: c.trim(), ok: q.correct.includes(j) }))
          .filter(x => x.text);
        return {
          assignment_id: assignment.id,
          question: q.prompt.trim(),
          choices: kept.map(x => x.text),
          answer: JSON.stringify(kept.flatMap((x, j) => x.ok ? [j] : []))
        };
      }
      return { assignment_id: assignment.id, question: q.prompt.trim(), answer: q.answer.trim() };
    });

    const { error: qError } = await supabaseClient.from("Assignment Questions").insert(rows);
    if (qError){
      console.error(qError);
      await supabaseClient.from("Assignments").delete().eq("id", assignment.id);
      showNote(qError.message, true);
      setDisabled(false);
      return;
    }

    showNote("Assigned!", false);
    setTimeout(() => { window.location.href = "mystudents.html"; }, 900);
  });
}

// ---- quiz ----

async function wireQuizPage(){
  const body = document.getElementById("quiz-body");
  if (!body) return;

  const params = new URLSearchParams(location.search);
  const assignmentId = params.get("assignment");
  const chapter = params.get("chapter") || "1";
  const personId = params.get("person");
  const isTutor = (await getType()) === "tutor";
  const rosterPage = isTutor ? "mystudents.html" : "mytutors.html";

  const titleEl = document.getElementById("quiz-title");
  if (titleEl) titleEl.textContent = `Chapter ${chapter} Quiz`;
  const backLink = document.getElementById("quiz-back-link");
  if (backLink) backLink.setAttribute("href", rosterPage);
  const counterEl = document.getElementById("quiz-counter");

  let questions = QUIZ_QUESTIONS;
  if (assignmentId){
    const set = await loadAssignmentSet(assignmentId);
    if (!set || !set.questions.length){
      if (counterEl) counterEl.textContent = "";
      body.innerHTML = `<div class="empty-state"><p><strong>Couldn't load this quiz.</strong></p></div>`;
      return;
    }
    questions = set.questions;
    if (titleEl) titleEl.textContent = set.assignment.assignment_name;
  }
  const scoreKey = assignmentId ? `tb_quiz_score_${assignmentId}` : `tb_quiz_score_${personId}_${chapter}`;

  let index = 0;
  let score = 0;
  let selected = new Set();
  let submitted = false;
  const total = questions.length;

  function renderQuestion(){
    const q = questions[index];
    if (counterEl) counterEl.textContent = `${index + 1}/${total}`;

    const optionsHtml = q.choices.map((choice, i) => `
      <label class="quiz-option" data-i="${i}">
        <input type="checkbox" ${selected.has(i) ? "checked" : ""} ${submitted ? "disabled" : ""}>
        <span class="quiz-option-text">${esc(choice)}</span>
      </label>`).join("");

    const nextLabel = index === total - 1 ? "See Results" : "Next Question";

    body.innerHTML = `
      <p class="quiz-question">${esc(q.prompt)}</p>
      <div class="quiz-options">${optionsHtml}</div>
      <div class="quiz-actions">
        <button class="btn btn-primary" id="quiz-submit-btn" ${submitted || selected.size === 0 ? "disabled" : ""}>Submit</button>
        ${submitted ? `<button class="btn btn-primary" id="quiz-next-btn">${nextLabel}</button>` : ""}
      </div>`;

    if (submitted){
      body.querySelectorAll(".quiz-option").forEach(opt => {
        const i = parseInt(opt.dataset.i, 10);
        if (q.correct.includes(i)) opt.classList.add("correct");
        else if (selected.has(i)) opt.classList.add("incorrect");
      });
    }

    body.querySelectorAll('.quiz-option input[type="checkbox"]').forEach(input => {
      input.addEventListener("change", () => {
        const i = parseInt(input.closest(".quiz-option").dataset.i, 10);
        if (input.checked) selected.add(i); else selected.delete(i);
        const submitBtn = document.getElementById("quiz-submit-btn");
        if (submitBtn) submitBtn.disabled = selected.size === 0;
      });
    });

    const submitBtn = document.getElementById("quiz-submit-btn");
    submitBtn.addEventListener("click", () => {
      submitted = true;
      const correctSet = new Set(q.correct);
      const isCorrect = correctSet.size === selected.size && [...correctSet].every(i => selected.has(i));
      if (isCorrect) score++;
      renderQuestion();
    });

    const nextBtn = document.getElementById("quiz-next-btn");
    if (nextBtn){
      nextBtn.addEventListener("click", () => {
        index++;
        selected = new Set();
        submitted = false;
        if (index < total) renderQuestion();
        else finishQuiz();
      });
    }
  }

  function finishQuiz(){
    if (assignmentId || personId) localStorage.setItem(scoreKey, score);
    if (counterEl) counterEl.textContent = `${total}/${total}`;
    body.innerHTML = `
      <div class="quiz-complete">
        <p>Quiz complete!</p>
        <div class="score">${score}/${total}</div>
        <a class="btn btn-primary" href="${rosterPage}">Back to ${isTutor ? "My Students" : "My Tutors"}</a>
      </div>`;
  }

  renderQuestion();
}

// ---- flashcards ----

async function wireFlashcardsPage(){
  const body = document.getElementById("flash-body");
  if (!body) return;

  const params = new URLSearchParams(location.search);
  const assignmentId = params.get("assignment");
  const chapter = params.get("chapter") || "1";
  const isTutor = (await getType()) === "tutor";

  const titleEl = document.getElementById("flash-title");
  if (titleEl) titleEl.textContent = `Chapter ${chapter} Flashcards`;
  const backLink = document.getElementById("quiz-back-link");
  if (backLink) backLink.setAttribute("href", isTutor ? "mystudents.html" : "mytutors.html");

  let cards = FLASHCARD_ITEMS;
  if (assignmentId){
    const set = await loadAssignmentSet(assignmentId);
    if (!set || !set.questions.length){
      body.innerHTML = `<div class="empty-state"><p><strong>Couldn't load these flashcards.</strong></p></div>`;
      return;
    }
    cards = set.questions;
    if (titleEl) titleEl.textContent = set.assignment.assignment_name;
  }

  let index = 0;
  let showingAnswer = false;

  function render(){
    const card = cards[index];
    body.innerHTML = `
      <div class="flashcard">
        <p class="flashcard-text ${showingAnswer ? "is-answer" : ""}">${esc(showingAnswer ? card.back : card.front)}</p>
        <div class="flashcard-actions">
          <button class="btn" id="back-btn">Back</button>
          <button class="btn" id="flip-btn">Flip</button>
          <button class="btn" id="next-btn">Next</button>
        </div>
      </div>
      <div class="flashcard-progress">Card ${index + 1}/${cards.length}</div>`;

    document.getElementById("back-btn").addEventListener("click", () => {
      showingAnswer = false;
      index = (index - 1 + cards.length) % cards.length;
      render();
    });
    document.getElementById("flip-btn").addEventListener("click", () => {
      showingAnswer = !showingAnswer;
      render();
    });
    document.getElementById("next-btn").addEventListener("click", () => {
      showingAnswer = false;
      index = (index + 1) % cards.length;
      render();
    });
  }

  render();
}

// ---- login/settings ----

function wireLoginForm(){

  const form = document.getElementById("login-form");
  if(!form){
    return;
  }
  
  form.addEventListener("submit", async(event) =>{
    event.preventDefault();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    const {data, error} = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if(error){
      alert(error.message);
      return;
    }

    const user = data.user;
    const {data: userInfo, error: infoError} = await supabaseClient
      .from("User Information")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if(infoError){
      console.error(error);
      alert(infoError.message);
      return;
    }
    
    alert("Logged in!");

    if(!userInfo){
      window.location.href = "accountsetup.html";
    }
    else{
      window.location.href = "home.html";
    }
  });

}

function wireSignupForm(){
  
  const form = document.getElementById("signup-form");
  if(!form){
    return;
  }

  form.addEventListener("submit", async(event) => {
    event.preventDefault();
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;

    const { data, error} = await supabaseClient.auth.signUp({
      email: email,
      password: password
    });

    if(error){
      console.error(error.message);
      alert(error.message);
      return;
    }
    
    if (!data.session) {
      alert("Account created! Check your email to verify your account, then log in.");
      window.location.href = "login.html";
      return;
    }

    alert("Account created! Choose your role to finish setup.");
    window.location.href = "accountsetup.html";
  });
  
}

function wireSetUpForm(){
  const form = document.getElementById("setup-form");
  if(!form){
    return;
  }
  const subForm = document.getElementById("role-form")
  if(!subForm){
    return;
  }
  const locationButton = document.getElementById("use-location");
  const addressInput = document.getElementById("address");
  const latitudeInput = document.getElementById("latitude");
  const longitudeInput = document.getElementById("longitude");
  const locationStatus = document.getElementById("location-status");

  function setLocationStatus(message, isError){
    if (!locationStatus) return;
    locationStatus.textContent = message;
    locationStatus.classList.toggle("is-error", Boolean(isError));
  }

  if (locationButton){
    locationButton.addEventListener("click", () => {
      if (!navigator.geolocation){
        setLocationStatus("Location is not supported by this browser.", true);
        return;
      }

      locationButton.disabled = true;
      setLocationStatus("Requesting your current location…");
      navigator.geolocation.getCurrentPosition(async position => {
        const latitude = roundCoord(position.coords.latitude);
        const longitude = roundCoord(position.coords.longitude);
        try {
          const query = `${longitude},${latitude}`;
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`
          );
          if (!response.ok) {
            throw new Error(`Geocoding request failed (${response.status}).`);
          }

          const result = await response.json();
          const address = result.features && result.features[0] && result.features[0].place_name;
          if (!address) {
            throw new Error("No address was found for your current location.");
          }

          addressInput.value = address;
          latitudeInput.value = String(latitude);
          longitudeInput.value = String(longitude);
          setLocationStatus("Location found. You can continue setup.");
        } catch (error) {
          console.error("Unable to convert location to an address:", error);
          setLocationStatus("We could not find an address for your location. Please try again.", true);
        } finally {
          locationButton.disabled = false;
        }
      }, error => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Allow access and try again."
          : "We could not access your current location. Please try again.";
        setLocationStatus(message, true);
        locationButton.disabled = false;
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
    });
  }

  form.addEventListener("submit", async(event) => {
    event.preventDefault();
    const selected = subForm.querySelector('input[name="role"]:checked');

    if (!selected) {
      alert("Please select a role.");
      return;
    }

    const {data: {user}, error:userError} = await supabaseClient.auth.getUser();

    if(userError || !user){
      console.error(userError);
      const { error: signOutError } = await supabaseClient.auth.signOut({ scope: "local" });
      if (signOutError) console.error(signOutError);
      alert("Your login session is no longer valid. Please log in again.");
      window.location.href = "login.html";
      return;
    }

    const name = document.getElementById("name").value;
    const rate = document.getElementById("rate").value;
    const mode = document.getElementById("tutor-type").value;
    const subjectList = Array.from(document.querySelectorAll('#subjects input[type="checkbox"]:checked')).map(i => i.value);
    if (subjectList.length === 0){
      alert("Please select at least one subject.");
      return;
    }
    const subject = subjectList.join(",");
    const address = addressInput ? addressInput.value : "";
    const latitude = latitudeInput ? roundCoord(latitudeInput.value) : "";
    const longitude = longitudeInput ? roundCoord(longitudeInput.value) : "";

    const {error} = await supabaseClient
      .from("User Information")
      .insert({
        name: name,
        rate: rate,
        mode: mode,
        subjects: subject,
        type: selected.value,
        latitude: latitude,
        longitude: longitude
      });

    if(error){
      console.error(error);
      alert(error.message);
      return;
    }

    window.location.href = "home.html";
  });
}

async function wireSettingsForm(){
  const form = document.getElementById("settings-form");
  if (!form) return;

  const {data: {user}} = await supabaseClient.auth.getUser();
  if (!user){
    window.location.href = "login.html";
    return;
  }

  const description = document.getElementById("description");
  const education = document.getElementById("education");
  const experience = document.getElementById("experience");
  const rateInput = document.getElementById("rate");
  const modeSelect = document.getElementById("tutor-type");
  const addressInput = document.getElementById("address");
  const latitudeInput = document.getElementById("latitude");
  const longitudeInput = document.getElementById("longitude");
  const locationButton = document.getElementById("use-location");
  const locationStatus = document.getElementById("location-status");
  const saveBtn = document.getElementById("submit-btn");
  const saveNote = document.getElementById("save-note");
  const subjectBoxes = () => Array.from(document.querySelectorAll('#subjects input[type="checkbox"]'));
  const roleRadios = () => Array.from(document.querySelectorAll('#role-group input[name="role"]'));

  function setLocationStatus(message, isError){
    if (!locationStatus) return;
    locationStatus.textContent = message;
    locationStatus.classList.toggle("is-error", Boolean(isError));
  }

  async function reverseGeocode(latitude, longitude){
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${longitude},${latitude}`)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`
    );
    if (!response.ok) throw new Error(`Geocoding request failed (${response.status}).`);
    const result = await response.json();
    const address = result.features && result.features[0] && result.features[0].place_name;
    if (!address) throw new Error("No address was found for that location.");
    return address;
  }

  const { data: me, error: loadError } = await supabaseClient
    .from("User Information")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (loadError){
    console.error(loadError);
    alert(loadError.message);
    return;
  }
  if (!me){
    window.location.href = "accountsetup.html";
    return;
  }

  const originalRole = me.type;
  description.value = me.profile_description || "";
  education.value = me.education || "";
  experience.value = me.experience || "";
  rateInput.value = me.rate ?? "";
  if (me.mode) modeSelect.value = String(me.mode).toLowerCase();
  const mySubjects = parseSubjects(me.subjects);
  subjectBoxes().forEach(box => { box.checked = mySubjects.includes(box.value); });
  roleRadios().forEach(r => { r.checked = r.value === me.type; });

  const hasValue = v => v !== null && v !== undefined && v !== "";
  if (hasValue(me.latitude) && hasValue(me.longitude)){
    latitudeInput.value = roundCoord(me.latitude);
    longitudeInput.value = roundCoord(me.longitude);
    addressInput.value = "Location saved";
    setLocationStatus("An approximate location (about 1 km) is saved. Use the button to update it.");
  }

  // ---- change location ----
  if (locationButton){
    locationButton.addEventListener("click", () => {
      if (!navigator.geolocation){
        setLocationStatus("Location is not supported by this browser.", true);
        return;
      }
      locationButton.disabled = true;
      setLocationStatus("Requesting your current location…");
      navigator.geolocation.getCurrentPosition(async position => {
        const latitude = roundCoord(position.coords.latitude);
        const longitude = roundCoord(position.coords.longitude);
        try {
          addressInput.value = await reverseGeocode(latitude, longitude);
          latitudeInput.value = String(latitude);
          longitudeInput.value = String(longitude);
          setLocationStatus("Location found. Press Save Changes to keep it.");
        } catch (error) {
          console.error("Unable to convert location to an address:", error);
          setLocationStatus("We could not find an address for your location. Please try again.", true);
        } finally {
          locationButton.disabled = false;
        }
      }, error => {
        setLocationStatus(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Allow access and try again."
            : "We could not access your current location. Please try again.",
          true);
        locationButton.disabled = false;
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
    });
  }

  // ---- save ----
  let noteTimer;
  function flashSaved(){
    if (!saveNote) return;
    saveNote.style.opacity = "1";
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { saveNote.style.opacity = "0"; }, 2200);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const subjectList = subjectBoxes().filter(b => b.checked).map(b => b.value);
    if (!subjectList.length){
      alert("Please select at least one subject.");
      return;
    }
    const role = (roleRadios().find(r => r.checked) || {}).value;
    if (!role){
      alert("Please select a role.");
      return;
    }
    if (rateInput.value === "" || Number(rateInput.value) < 0){
      alert("Please enter a valid rate.");
      return;
    }
    if (role !== originalRole &&
        !confirm(`Switch your account from ${originalRole} to ${role}? Your existing tutor/student connections and assignments will not be converted.`)){
      return;
    }

    const update = {
      profile_description: description.value,
      type: role,
      rate: rateInput.value,
      mode: modeSelect.value,
      subjects: subjectList.join(",")
    };
    if (latitudeInput.value !== "" && longitudeInput.value !== ""){
      update.latitude = roundCoord(latitudeInput.value);
      update.longitude = roundCoord(longitudeInput.value);
    }

    saveBtn.disabled = true;
    const { error: saveError } = await supabaseClient
      .from("User Information")
      .update(update)
      .eq("id", user.id);
    if (saveError){
      console.error(saveError);
      alert(saveError.message);
      saveBtn.disabled = false;
      return;
    }

    const { error: extraError } = await supabaseClient
      .from("User Information")
      .update({ education: education.value, experience: experience.value })
      .eq("id", user.id);
    saveBtn.disabled = false;
    if (extraError){
      console.error(extraError);
      alert("Your preferences were saved, but Education / Past Experiences could not be: " + extraError.message);
      return;
    }

    if (role !== originalRole){
      window.location.href = "home.html";
      return;
    }
    flashSaved();
  });
}

async function wireEditLoginPage(){
  const usernameForm = document.getElementById("username-form");
  const passwordForm = document.getElementById("password-form");
  if(!usernameForm || !passwordForm){
    return;
  }

  const {data: {user}, error: userError} = await supabaseClient.auth.getUser();
  if(userError){
    alert("login invalid");
    return;
  }

  usernameForm.addEventListener("submit", async(event) => {
    event.preventDefault();
    const newUser = document.getElementById("username-input");
    const {error} = await supabaseClient
      .from("User Information")
      .update({
        name: newUser.value
      })
      .eq("id", user.id);
    if(error){
      alert("Error updating username");
      return;
    }
    alert("Name Updated Successfully!");
  });

  passwordForm.addEventListener("submit", async(event) =>{
    event.preventDefault();
    const oldPass = document.getElementById("old-password");
    const newPass = document.getElementById("new-password");

    const {error: verifyError} = await supabaseClient.auth.signInWithPassword({
      email: user.email,
      password: oldPass.value
    });

    if(verifyError){
      alert(verifyError.message);
      return;
    }

    const {error: updateError} = await supabaseClient.auth.updateUser({
      password: newPass.value
    });

    if(updateError){
      alert(updateError.message);
      return;
    }

    alert("Password Changed Successfully!");
    window.location.href = "settings.html";
  });
}

// ---- tabs ----
function wireMyTutorsTabs(){
  const tabs = document.querySelectorAll(".tab-btn");
  const tutorsPane = document.getElementById("tab-tutors");
  const mapPane = document.getElementById("tutor-map") || document.getElementById("student-map");
  const calPane = document.getElementById("tab-calendar");
  if (!tabs.length || !tutorsPane || !mapPane) return;

  let map = null;
  let mapTried = false;

  function initMap(){
    if (typeof mapboxgl === "undefined"){
      mapPane.innerHTML = `<div class="empty-state"><p><strong>The map couldn't load.</strong><br>Check your connection and refresh the page.</p></div>`;
      return;
    }
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    map = new mapboxgl.Map({
      container: mapPane.id,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-118.2437, 34.0522],
      zoom: 10
    });
    map.addControl(new mapboxgl.NavigationControl());

    const loaded = new Promise(res => map.on("load", res));
    Promise.all([rosterReady, loaded]).then(([people]) => showPeople(people));
  }

  const AREA_RADIUS_M = 1000;
  function circlePolygon(lng, lat, radiusM, steps = 48){
    const dLat = radiusM / 111320;
    const dLng = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
    const ring = [];
    for (let i = 0; i <= steps; i++){
      const t = (2 * Math.PI * i) / steps;
      ring.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
    }
    return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
  }

  function showPeople(people){
    const located = people.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const missing = people.length - located.length;

    if (missing > 0 || !people.length){
      const note = document.createElement("div");
      note.className = "map-note";
      note.textContent = !people.length
        ? "No one in your list yet."
        : located.length
          ? `${missing} ${missing === 1 ? "person hasn't" : "people haven't"} shared a location.`
          : "No one in your list has shared a location yet.";
      mapPane.appendChild(note);
    }
    if (!located.length) return;

    map.addSource("approx-areas", {
      type: "geojson",
      data: { type: "FeatureCollection", features: located.map(p => circlePolygon(p.lng, p.lat, AREA_RADIUS_M)) }
    });
    map.addLayer({ id: "approx-fill", type: "fill", source: "approx-areas",
                   paint: { "fill-color": "#5f9ea8", "fill-opacity": 0.28 } });
    map.addLayer({ id: "approx-line", type: "line", source: "approx-areas",
                   paint: { "line-color": "#3f7f8a", "line-width": 2 } });

    const bounds = new mapboxgl.LngLatBounds();
    located.forEach(p => {
      const el = document.createElement("div");
      el.className = "map-avatar";
      el.textContent = p.initials;
      el.setAttribute("aria-label", `${p.name}, approximate location`);

      const popup = new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(`
        <strong>${esc(p.name)}</strong><br>
        ${p.subject ? esc(p.subject) + "<br>" : ""}
        ${p.mode ? esc(p.mode) + "<br>" : ""}
        <em>Approximate location</em>`);

      new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
      bounds.extend([p.lng, p.lat]);
    });

    if (located.length === 1) map.jumpTo({ center: [located[0].lng, located[0].lat], zoom: 12 });
    else map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 0 });
  }

  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      tabs.forEach(b => b.classList.toggle("active", b === btn));
      tutorsPane.hidden = tab !== "tutors";
      mapPane.hidden = tab !== "map";
      if (calPane) calPane.hidden = tab !== "calendar";

      if (tab === "map"){
        if (!map && !mapTried){ mapTried = true; initMap(); }
        else if (map) map.resize();
      }
    });
  });
}

// ---- calendar ----

async function wireCalendar(){
  const root = document.getElementById("tab-calendar");
  if (!root) return;

  const role = await getType();
  if (!role) return;
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const isTutor = role === "tutor";
  const myCol = isTutor ? "tutor_id" : "student_id";
  const otherCol = isTutor ? "student_id" : "tutor_id";
  const otherLabel = isTutor ? "student" : "tutor";

  const people = new Map();
  const { data: links, error: linkError } = await supabaseClient
    .from("Tutor Student Connections")
    .select(otherCol)
    .eq(myCol, user.id);
  if (linkError) console.error(linkError);
  if (links && links.length){
    const { data: ppl, error: pplError } = await supabaseClient
      .from("User Information")
      .select("id, name")
      .in("id", links.map(l => l[otherCol]));
    if (pplError) console.error(pplError);
    (ppl || []).forEach(p => people.set(p.id, p.name || "Unnamed"));
  }

  root.innerHTML = `
    <div class="cal-main">
      <div class="cal-head">
        <button type="button" class="cal-nav" id="cal-prev" aria-label="Previous month">&#8249;</button>
        <h3 id="cal-month"></h3>
        <button type="button" class="cal-nav" id="cal-next" aria-label="Next month">&#8250;</button>
        <button type="button" class="btn btn-sm" id="cal-today">Today</button>
      </div>
      <div class="cal-dow"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
      <div class="cal-grid" id="cal-grid"></div>
    </div>
    <div class="cal-side">
      <h3 id="cal-day-title"></h3>
      <div id="cal-day-list"></div>
      <form class="cal-form" id="cal-form">
        <h3>Add event</h3>
        <div class="field">
          <label for="cal-with">With</label>
          <select id="cal-with" required>
            ${people.size
              ? [...people].map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("")
              : `<option value="">No ${otherLabel}s in your list yet</option>`}
          </select>
        </div>
        <div class="field">
          <label for="cal-ev-title">Title</label>
          <input type="text" id="cal-ev-title" maxlength="80" autocomplete="off" required>
        </div>
        <div class="field">
          <label for="cal-date">Date</label>
          <input type="date" id="cal-date" required>
        </div>
        <div class="cal-row">
          <div class="field">
            <label for="cal-start">Start</label>
            <input type="time" id="cal-start" required>
          </div>
          <div class="field">
            <label for="cal-end">End</label>
            <input type="time" id="cal-end">
          </div>
        </div>
        <div class="field">
          <label for="cal-notes">Notes</label>
          <textarea id="cal-notes" maxlength="300" placeholder="Optional"></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-block" ${people.size ? "" : "disabled"}>Add Event</button>
      </form>
    </div>`;

  const gridEl = document.getElementById("cal-grid");
  const monthEl = document.getElementById("cal-month");
  const dayTitleEl = document.getElementById("cal-day-title");
  const dayListEl = document.getElementById("cal-day-list");
  const dateInput = document.getElementById("cal-date");

  const pad = n => String(n).padStart(2, "0");
  const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const timeOf = iso => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  let view = new Date(); view.setDate(1);
  let selectedKey = keyOf(new Date());
  let events = [];

  const gridStart = () => new Date(view.getFullYear(), view.getMonth(), 1 - view.getDay());

  async function load(){
    const start = gridStart();
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 42);
    const { data, error } = await supabaseClient
      .from("Events")
      .select("*")
      .or(`tutor_id.eq.${user.id},student_id.eq.${user.id}`)
      .gte("start_at", start.toISOString())
      .lt("start_at", end.toISOString())
      .order("start_at", { ascending: true });
    if (error){
      console.error(error);
      gridEl.innerHTML = `<div class="empty-state"><p><strong>Couldn't load events.</strong></p></div>`;
      return;
    }
    events = data;
    render();
  }

  function eventsOn(key){
    return events.filter(e => keyOf(new Date(e.start_at)) === key);
  }

  function render(){
    monthEl.textContent = view.toLocaleDateString([], { month: "long", year: "numeric" });
    const start = gridStart();
    const todayKey = keyOf(new Date());
    let html = "";
    for (let i = 0; i < 42; i++){
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = keyOf(d);
      const list = eventsOn(key);
      const cls = ["cal-cell",
        d.getMonth() !== view.getMonth() ? "other" : "",
        key === todayKey ? "today" : "",
        key === selectedKey ? "selected" : ""].join(" ");
      const chips = list.slice(0, 2).map(e =>
        `<div class="cal-chip ${e.creator_id === user.id ? "mine" : "theirs"}">${esc(timeOf(e.start_at))} ${esc(e.title)}</div>`).join("");
      const more = list.length > 2 ? `<div class="cal-more">+${list.length - 2} more</div>` : "";
      html += `<button type="button" class="${cls}" data-key="${key}"><span class="cal-num">${d.getDate()}</span>${chips}${more}</button>`;
    }
    gridEl.innerHTML = html;
    gridEl.querySelectorAll(".cal-cell").forEach(cell => {
      cell.addEventListener("click", () => selectDay(cell.dataset.key));
    });
    renderDay();
  }

  function renderDay(){
    dayTitleEl.textContent = fromKey(selectedKey).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    const list = eventsOn(selectedKey);
    if (!list.length){
      dayListEl.innerHTML = `<p class="cal-empty">No events this day.</p>`;
      return;
    }
    dayListEl.innerHTML = list.map(e => {
      const who = people.get(e[otherCol]) || "Unknown";
      const when = e.end_at ? `${timeOf(e.start_at)} – ${timeOf(e.end_at)}` : timeOf(e.start_at);
      const mine = e.creator_id === user.id;
      return `
      <div class="cal-event">
        <div>
          <div class="cal-event-title">${esc(e.title)}</div>
          <div class="cal-event-meta">${esc(when)} · with ${esc(who)}${mine ? "" : " (added by them)"}</div>
          ${e.notes ? `<div class="cal-event-notes">${esc(e.notes)}</div>` : ""}
        </div>
        ${mine ? `<button type="button" class="cal-del" data-id="${esc(e.id)}" aria-label="Delete event">&times;</button>` : ""}
      </div>`;
    }).join("");
    dayListEl.querySelectorAll(".cal-del").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this event for both of you?")) return;
        const { error } = await supabaseClient.from("Events").delete().eq("id", btn.dataset.id);
        if (error){ console.error(error); alert(error.message); return; }
        load();
      });
    });
  }

  function selectDay(key){
    selectedKey = key;
    dateInput.value = key;
    const d = fromKey(key);
    if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()){
      view = new Date(d.getFullYear(), d.getMonth(), 1);
      load();
    } else {
      render();
    }
  }

  document.getElementById("cal-prev").addEventListener("click", () => {
    view = new Date(view.getFullYear(), view.getMonth() - 1, 1); load();
  });
  document.getElementById("cal-next").addEventListener("click", () => {
    view = new Date(view.getFullYear(), view.getMonth() + 1, 1); load();
  });
  document.getElementById("cal-today").addEventListener("click", () => selectDay(keyOf(new Date())));

  document.getElementById("cal-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const withId = document.getElementById("cal-with").value;
    const title = document.getElementById("cal-ev-title").value.trim();
    const date = dateInput.value;
    const start = document.getElementById("cal-start").value;
    const end = document.getElementById("cal-end").value;
    const notes = document.getElementById("cal-notes").value.trim();
    if (!withId || !title || !date || !start) return;

    const startAt = new Date(`${date}T${start}`);
    const endAt = end ? new Date(`${date}T${end}`) : null;
    if (endAt && endAt <= startAt){
      alert("The end time must be after the start time.");
      return;
    }

    const { error } = await supabaseClient.from("Events").insert({
      creator_id: user.id,
      tutor_id: isTutor ? user.id : withId,
      student_id: isTutor ? withId : user.id,
      title,
      notes: notes || null,
      start_at: startAt.toISOString(),
      end_at: endAt ? endAt.toISOString() : null
    });
    if (error){
      console.error(error);
      alert(error.message);
      return;
    }
    document.getElementById("cal-ev-title").value = "";
    document.getElementById("cal-end").value = "";
    document.getElementById("cal-notes").value = "";
    selectDay(date);
    load();
  });

  supabaseClient
    .channel("events-" + user.id)
    .on("postgres_changes", { event: "*", schema: "public", table: "Events" }, () => load())
    .subscribe();

  dateInput.value = selectedKey;
  load();
}

// ---- avatar ----

function wireProfileAvatars(){
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-profile-id]");
    if (!el) return;
    e.stopPropagation();
    window.location.href = `profile.html?id=${encodeURIComponent(el.dataset.profileId)}`;
  }, true);
}

async function wireOwnAvatar(){
  const el = document.querySelector(".profile-card .cover .avatar");
  if (!el || el.id === "profile-avatar") return;
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  const { data } = await supabaseClient
    .from("User Information")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  const name = (data && data.name) || "";
  el.textContent = name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  el.setAttribute("aria-label", name ? `${name}'s avatar` : "Your avatar");
}

document.addEventListener("DOMContentLoaded", () => {
  updateTutorNav();
  wireProfileAvatars();
  wireOwnAvatar();
  highlightActiveNav();
  wireSearchPage();
  wireSignupForm();
  wireHomeFeed();
  wireSetUpForm();
  wireMessagesPage();
  wireMyTutorsPage();
  wireMyTutorsTabs();
  wireCalendar();
  wireProfilePage();
  wireEditLoginPage();
  wireAssignHomeworkPage();
  wireCreatePage();
  wireQuizPage();
  wireFlashcardsPage();
  wireLoginForm();
  wireSettingsForm();
});
