// === CONFIG: your Cloudflare Worker base ===
const API_BASE = "https://navigator-relay.ljbarg0.workers.dev";

// DOM
const orgSelect   = document.getElementById("orgSelect");
const pcpOnRecord = document.getElementById("pcpOnRecord");
const snippetEl   = document.getElementById("snippet");
const suggestBtn  = document.getElementById("suggestBtn");
const reloadBtn   = document.getElementById("reloadBtn");

const ruleOut     = document.getElementById("ruleOut");
const commsMeta   = document.getElementById("commsMeta");
const composerOut = document.getElementById("composerOut");
const copyBtn     = document.getElementById("copyBtn");
const downloadTxt = document.getElementById("downloadTxt");
const mailtoBtn   = document.getElementById("mailtoBtn");

// Q&A modal
const qaModal   = document.getElementById("qaModal");
const qaForm    = document.getElementById("qaForm");
const qaSubmit  = document.getElementById("qaSubmit");
const qaCancel  = document.getElementById("qaCancel");

// ---------- helpers ----------
function showModal() {
  qaModal?.classList.remove("hidden");
  qaModal?.setAttribute("aria-hidden", "false");
}
function hideModal() {
  qaModal?.classList.add("hidden");
  qaModal?.setAttribute("aria-hidden", "true");
  // clear form fields so next time it's fresh
  if (qaForm) qaForm.innerHTML = "";
}

function fillFields(text, ctx) {
  return (text || "")
    .replace(/\{\{\s*currentDate\s*\}\}/g, new Date().toLocaleDateString())
    .replace(/\{\{\s*orgName\s*\}\}/g, ctx.orgName || "")
    .replace(/\{\{\s*specialist\s*\}\}/g, ctx.specialist || "")
    .replace(/\{\{\s*pcpName\s*\}\}/g, ctx.pcpName || "{{pcpName}}")
    .replace(/\{\{\s*patientName\s*\}\}/g, ctx.patientName || "{{patientName}}")
    .replace(/\{\{\s*patientDOB\s*\}\}/g, ctx.patientDOB || "{{patientDOB}}")
    .replace(/\{\{\s*patientMRN\s*\}\}/g, ctx.patientMRN || "{{patientMRN}}")
    .replace(/\{\{\s*reportSnippet\s*\}\}/g, ctx.snippet || "")
    .replace(/\{\{\s*findingDescription\s*\}\}/g, ctx.finding || "")
    .replace(/\{\{\s*recommendation\s*\}\}/g, ctx.recommendation || "");
}

async function loadOrgs() {
  if (!orgSelect) return;
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

function renderSuggestion(j, { orgName, snippet }) {
  // ---- left card: rule + confidence + guideline
  const rule = j.chosenRule || {};
  const sev  = String(rule.Severity || "").toLowerCase();
  const badge =
    sev
      ? `<span class="badge ${sev}">${rule.Severity}</span>`
      : "";

  // confidence + guideline lines
  const conf   = j.confidence || {};
  const confPct =
    typeof conf.score === "number"
      ? `${Math.round(Math.max(0, Math.min(1, conf.score)) * 100)}%`
      : "";
  const confLine =
    confPct
      ? `<div class="meta"><b>Confidence:</b> ${confPct}${conf.explanation ? ` — ${conf.explanation}` : ""}</div>`
      : "";

  const guideLine =
    j.guideline
      ? `<div class="meta"><b>Guideline:</b> ${j.guideline}</div>`
      : "";

  const rationaleLine =
    j.rationale
      ? `<div class="meta"><b>Why:</b> ${j.rationale}</div>`
      : "";

  ruleOut.innerHTML = `
    <div><b>${rule.Finding || "(unknown rule)"}</b> ${badge}</div>
    <div style="margin-top:6px"><i>Condition:</i> ${rule.Condition || "—"}</div>
    <div style="margin-top:6px"><i>Recommendation:</i> ${rule.Recommendation || "—"}</div>
    <div style="margin-top:10px">${confLine}${guideLine}${rationaleLine}</div>
  `;

  // ---- right card: routing + composed message
  const routing = j.routing || {};
  const message = j.message || {};
  commsMeta.textContent = `${routing.channel || "?"} → ${routing.recipient || "?"}${
    routing.templateName ? ` | ${routing.templateName}` : ""
  }`;

  const ctx = {
    orgName,
    specialist: routing.specialist || "",
    snippet,
    finding: rule.Finding || "",
    recommendation: rule.Recommendation || "",
  };
  const subj = fillFields(message.subject || "", ctx);
  const body = fillFields(message.body || "", ctx);
  composerOut.value = (subj ? `Subject: ${subj}\n\n` : "") + body;

  // download + mailto
  const blob = new Blob([composerOut.value], { type: "text/plain" });
  downloadTxt.href = URL.createObjectURL(blob);
  const mSubject = encodeURIComponent(subj || "Incidental finding");
  const mBody = encodeURIComponent(composerOut.value);
  mailtoBtn.href = `mailto:?subject=${mSubject}&body=${mBody}`;
}

async function callSuggest({ orgName, pcp, snippet, answers }) {
  const r = await fetch(`${API_BASE}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orgName,
      pcpOnRecord: pcp,
      snippet,
      ...(answers ? { answers } : {}),
    }),
  });
  return r.json();
}

// ---------- events ----------
reloadBtn?.addEventListener("click", loadOrgs);

suggestBtn?.addEventListener("click", async () => {
  const orgName = decodeURIComponent(orgSelect?.value || "");
  const snippet = (snippetEl?.value || "").trim();
  const pcp     = !!pcpOnRecord?.checked;

  if (!orgName || !snippet) {
    alert("Select an organization and paste a report snippet.");
    return;
  }

  commsMeta.textContent = "Thinking with OpenAI…";
  composerOut.value = "";
  ruleOut.innerHTML = "—";

  try {
    // 1st call
    const j = await callSuggest({ orgName, pcp, snippet });
    if (j.error) throw new Error(j.error);

    // If the backend wants questions, show modal, then re-call with answers
    if (j.needsQuestions && Array.isArray(j.questions) && j.questions.length) {
      // build form
      qaForm.innerHTML = j.questions
        .map((q) => {
          const id = `q_${q.id}`;
          const ph =
            q.placeholder ||
            (q.type === "text"
              ? `e.g., "on statin", "CAD on problem list"`
              : "");
          if (q.type === "boolean") {
            return `
              <label class="form-row">
                <span>${q.label}</span>
                <input type="checkbox" id="${id}" />
              </label>`;
          }
          if (q.type === "number") {
            return `
              <label class="form-row">
                <span>${q.label}</span>
                <input type="number" id="${id}" />
              </label>`;
          }
          // default text
          return `
            <label class="form-row">
              <span>${q.label}</span>
              <input type="text" id="${id}" placeholder="${ph}" />
            </label>`;
        })
        .join("");

      showModal();

      // hook submit (one-shot)
      const onSubmit = async (e) => {
        e.preventDefault();
        // collect answers
        const answers = {};
        for (const q of j.questions) {
          const el = document.getElementById(`q_${q.id}`);
          if (!el) continue;
          if (q.type === "boolean") {
            answers[q.id] = !!el.checked;
          } else if (q.type === "number") {
            const num = Number(el.value);
            answers[q.id] = Number.isFinite(num) ? num : undefined;
          } else {
            answers[q.id] = el.value || "";
          }
        }

        hideModal();

        // second call with answers
        commsMeta.textContent = "Applying chart-review cues…";
        const j2 = await callSuggest({ orgName, pcp, snippet, answers });
        if (j2.error) throw new Error(j2.error);

        renderSuggestion(j2, { orgName, snippet });
        // clean handler
        qaForm.removeEventListener("submit", onSubmit);
      };

      qaSubmit.addEventListener("click", onSubmit, { once: true });

      // Cancel just closes and does nothing
      qaCancel?.addEventListener(
        "click",
        () => {
          hideModal();
          // If you want to continue without answers, render the first response:
          renderSuggestion(j, { orgName, snippet });
        },
        { once: true }
      );

      return; // stop here; render happens after modal submit/cancel
    }

    // no questions needed — render straight away
    renderSuggestion(j, { orgName, snippet });
  } catch (e) {
    commsMeta.textContent = `Error: ${e.message}`;
  }
});

// copy button
copyBtn?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(composerOut.value || "");
  } catch {}
});

// close modal when backdrop or X is clicked
qaModal?.addEventListener("click", (e) => {
  if (e.target?.dataset?.modalClose !== undefined || e.target === qaModal.querySelector(".modal__backdrop")) {
    hideModal();
  }
});

// boot
loadOrgs();
