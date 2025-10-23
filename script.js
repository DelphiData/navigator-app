// === CONFIG: set this to your Cloudflare Worker URL ===
const API_BASE = "https://navigator-relay.ljbarg0.workers.dev";

/* ---------- DOM ---------- */
const orgSelect    = document.getElementById("orgSelect");
const pcpOnRecord  = document.getElementById("pcpOnRecord");
const snippetEl    = document.getElementById("snippet");
const suggestBtn   = document.getElementById("suggestBtn");
const reloadBtn    = document.getElementById("reloadBtn");

const ruleOut      = document.getElementById("ruleOut");
const commsMeta    = document.getElementById("commsMeta");
const composerOut  = document.getElementById("composerOut");
const copyBtn      = document.getElementById("copyBtn");
const downloadTxt  = document.getElementById("downloadTxt");
const mailtoBtn    = document.getElementById("mailtoBtn");

// Modal
const qaModal      = document.getElementById("qaModal");
const qaForm       = document.getElementById("qaForm");
const qaSubmitBtn  = document.getElementById("qaSubmit");
const qaCloseEls   = document.querySelectorAll("[data-modal-close]");

/* ---------- Modal helpers ---------- */
function openModal() {
  qaModal.classList.remove("hidden");
  qaModal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  qaModal.classList.add("hidden");
  qaModal.setAttribute("aria-hidden", "true");
  qaForm.replaceChildren(); // clear previous questions
}
qaCloseEls.forEach((el) => el.addEventListener("click", closeModal));

/* ---------- Data loaders ---------- */
async function loadOrgs() {
  orgSelect.innerHTML = `<option>Loading…</option>`;
  try {
    const r = await fetch(`${API_BASE}/orgs`, { cache: "no-store" });
    const j = await r.json();
    const orgs = j.orgs || [];
    orgSelect.innerHTML =
      `<option value="">Select org…</option>` +
      orgs
        .map(
          (o) =>
            `<option value="${encodeURIComponent(o.OrgName)}">${o.OrgName}</option>`
        )
        .join("");
  } catch {
    orgSelect.innerHTML = `<option>Error loading orgs</option>`;
  }
}
reloadBtn?.addEventListener("click", loadOrgs);

/* ---------- Templating helpers ---------- */
function fillFields(text, ctx) {
  return (text || "")
    .replace(/\{\{\s*currentDate\s*\}\}/g, new Date().toLocaleDateString())
    .replace(/\{\{\s*orgName\s*\}\}/g, ctx.orgName || "")
    .replace(/\{\{\s*specialist\s*\}\}/g, ctx.specialist || "")
    .replace(/\{\{\s*pcpName\s*\}\}/g, ctx.pcpName || "{{pcpName}}")
    .replace(/\{\{\s*patientName\s*\}\}/g, ctx.patientName || "{{patientName}}")
    .replace(/\{\{\s*mrn\s*\}\}/g, ctx.mrn || "{{mrn}}")
    .replace(/\{\{\s*reportSnippet\s*\}\}/g, ctx.snippet || "")
    .replace(/\{\{\s*findingDescription\s*\}\}/g, ctx.finding || "")
    .replace(/\{\{\s*recommendation\s*\}\}/g, ctx.recommendation || "");
}

/* ---------- Rendering ---------- */
function renderSuggestion(j, { orgName, snippet }) {
  const rule = j.chosenRule || {};
  const routing = j.routing || {};
  const message = j.message || {};

  ruleOut.innerHTML = `
    <div><b>${rule.Finding || "(unknown rule)"}</b> ${
    rule.Severity
      ? `<span class="badge ${String(rule.Severity).toLowerCase()}">${rule.Severity}</span>`
      : ""
  }</div>
    <div style="margin-top:6px"><i>Condition:</i> ${rule.Condition || "—"}</div>
    <div style="margin-top:6px"><i>Recommendation:</i> ${
      rule.Recommendation || "—"
    }</div>
  `;

  commsMeta.textContent = `${routing.channel || "?"} → ${
    routing.recipient || "?"
  } ${routing.templateName ? `| ${routing.templateName}` : ""}`;

  const ctx = {
    orgName,
    specialist: routing.specialist || "",
    snippet,
    finding: rule.Finding || "",
    recommendation: rule.Recommendation || "",
  };
  const subject = fillFields(message.subject || "", ctx);
  const body = fillFields(message.body || "", ctx);
  composerOut.value = (subject ? `Subject: ${subject}\n\n` : "") + body;

  // helpers
  const blob = new Blob([composerOut.value], { type: "text/plain" });
  downloadTxt.href = URL.createObjectURL(blob);
  const mSubject = encodeURIComponent(subject || "Incidental finding");
  const mBody = encodeURIComponent(composerOut.value);
  mailtoBtn.href = `mailto:?subject=${mSubject}&body=${mBody}`;
}

/* ---------- Modal question rendering & answer collection ---------- */
function renderQuestions(questions) {
  qaForm.replaceChildren();
  for (const q of questions) {
    const row = document.createElement("div");
    row.className = "form-row";

    const label = document.createElement("label");
    label.textContent = q.label || q.id;

    let input;
    if (q.type === "boolean") {
      input = document.createElement("select");
      input.innerHTML = `
        <option value="">Select…</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      `;
    } else if (q.type === "number") {
      input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      input.placeholder = "0";
      input.inputMode = "decimal";
    } else {
      input = document.createElement("input");
      input.type = "text";
    }
    input.name = q.id;
    input.dataset.qType = q.type || "text";

    row.appendChild(label);
    row.appendChild(input);
    if (q.hint) {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = q.hint;
      row.appendChild(hint);
    }

    qaForm.appendChild(row);
  }
}

function collectAnswers() {
  const answers = {};
  const inputs = qaForm.querySelectorAll("input, select");
  for (const el of inputs) {
    const id = el.name;
    const t = el.dataset.qType || "text";
    let val = el.value;

    if (t === "boolean") {
      if (val === "") return { error: `Please select Yes/No for "${id}".` };
      val = val === "true";
    } else if (t === "number") {
      if (val === "") return { error: `Please enter a number for "${id}".` };
      const num = Number(val);
      if (!Number.isFinite(num)) return { error: `Invalid number for "${id}".` };
      val = num;
    }
    answers[id] = val;
  }
  return { answers };
}

/* ---------- Suggest Plan flow ---------- */
suggestBtn?.addEventListener("click", async () => {
  const orgName = decodeURIComponent(orgSelect.value || "");
  const snippet = (snippetEl.value || "").trim();
  const pcp = !!pcpOnRecord.checked;

  if (!orgName || !snippet) {
    alert("Select an organization and paste a report snippet.");
    return;
  }

  commsMeta.textContent = "Thinking with OpenAI…";
  composerOut.value = "";
  ruleOut.innerHTML = "—";

  try {
    // First call
    const r = await fetch(`${API_BASE}/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgName, pcpOnRecord: pcp, snippet }),
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error);

    // If Worker asks for more info, show modal and re-POST with answers
    if (j.needsQuestions && Array.isArray(j.questions)) {
      renderQuestions(j.questions);
      openModal();

      // Bind "Continue" handler (override any previous)
      qaSubmitBtn.onclick = async () => {
        const { answers, error } = collectAnswers();
        if (error) {
          alert(error);
          return;
        }
        commsMeta.textContent = "Applying answers…";
        closeModal();

        const r2 = await fetch(`${API_BASE}/suggest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgName, pcpOnRecord: pcp, snippet, answers }),
        });
        const j2 = await r2.json();
        if (j2.error) throw new Error(j2.error);

        renderSuggestion(j2, { orgName, snippet });
      };

      // stop here; the continuation happens on modal submit
      return;
    }

    // Otherwise render final suggestion
    renderSuggestion(j, { orgName, snippet });
  } catch (e) {
    commsMeta.textContent = `Error: ${e.message}`;
  }
});

/* ---------- Misc ---------- */
copyBtn?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(composerOut.value || "");
  } catch {}
});

// Boot
loadOrgs();
