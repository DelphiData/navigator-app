// === CONFIG: set this to your Cloudflare Worker URL ===
const API_BASE = "https://navigator-relay.ljbarg0.workers.dev";

// DOM
const orgSelect   = document.getElementById('orgSelect');
const pcpOnRecord = document.getElementById('pcpOnRecord');
const snippetEl   = document.getElementById('snippet');

const suggestBtn  = document.getElementById('suggestBtn');
const reloadBtn   = document.getElementById('reloadBtn');

const ruleOut     = document.getElementById('ruleOut');
const commsMeta   = document.getElementById('commsMeta');
const composerOut = document.getElementById('composerOut');

const copyBtn     = document.getElementById('copyBtn');
const downloadTxt = document.getElementById('downloadTxt');
const mailtoBtn   = document.getElementById('mailtoBtn');

// Modal elements
const qaModal  = document.getElementById('qaModal');
const qaForm   = document.getElementById('qaForm');
const qaSubmit = document.getElementById('qaSubmit');
const qaCancel = document.getElementById('qaCancel');

// --- utilities ---
function show(el)  { el?.classList?.remove('hidden'); el?.setAttribute?.('aria-hidden','false'); }
function hide(el)  { el?.classList?.add('hidden');    el?.setAttribute?.('aria-hidden','true'); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

function fillFields(text, ctx) {
  return (text || '')
    .replace(/\{\{\s*currentDate\s*\}\}/g, new Date().toLocaleDateString())
    .replace(/\{\{\s*orgName\s*\}\}/g, ctx.orgName || '')
    .replace(/\{\{\s*specialist\s*\}\}/g, ctx.specialist || '')
    .replace(/\{\{\s*pcpName\s*\}\}/g, ctx.pcpName || '{{pcpName}}')
    .replace(/\{\{\s*patientName\s*\}\}/g, ctx.patientName || '{{patientName}}')
    .replace(/\{\{\s*mrn\s*\}\}/g, ctx.mrn || '{{mrn}}')
    .replace(/\{\{\s*reportSnippet\s*\}\}/g, ctx.snippet || '')
    .replace(/\{\{\s*findingDescription\s*\}\}/g, ctx.finding || '')
    .replace(/\{\{\s*recommendation\s*\}\}/g, ctx.recommendation || '');
}

async function loadOrgs() {
  orgSelect.innerHTML = `<option>Loading…</option>`;
  try {
    const r = await fetch(`${API_BASE}/orgs`, { cache: 'no-store' });
    const j = await r.json();
    const orgs = j.orgs || [];
    orgSelect.innerHTML = `<option value="">Select org…</option>` +
      orgs.map(o => `<option value="${encodeURIComponent(o.OrgName)}">${escapeHtml(o.OrgName)}</option>`).join('');
  } catch (e) {
    orgSelect.innerHTML = `<option>Error loading orgs</option>`;
  }
}

// --- modal Q&A ---
function renderQuestions(questions) {
  qaForm.innerHTML = ''; // clear
  for (const q of questions) {
    const id = q.id;
    const label = q.label || id;
    const type = (q.type || 'text').toLowerCase();

    const field = document.createElement('label');
    field.className = 'qa-field';

    const span = document.createElement('span');
    span.textContent = label;

    let input;
    if (type === 'boolean') {
      input = document.createElement('select');
      input.innerHTML = `<option value="">—</option><option value="true">Yes</option><option value="false">No</option>`;
    } else if (type === 'number') {
      input = document.createElement('input');
      input.type = 'number';
      input.placeholder = 'e.g., 123';
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'e.g., "on statin", "CAD on problem list", "unknown"';
    }
    input.name = id;
    input.id = `qa_${id}`;

    field.appendChild(span);
    field.appendChild(input);
    qaForm.appendChild(field);
  }
}

function collectAnswers() {
  const ans = {};
  const elements = qaForm.querySelectorAll('input, select, textarea');
  elements.forEach(el => {
    let v = el.value;
    if (v === '') return; // omit empty -> worker treats as missing
    if (v === 'true') v = true;
    if (v === 'false') v = false;
    ans[el.name] = v;
  });
  return ans;
}

function showQAModalAndCollect(questions) {
  renderQuestions(questions);
  show(qaModal);

  return new Promise((resolve) => {
    // Ensure we don't submit the page
    const onSubmit = (ev) => {
      ev.preventDefault();
      const answers = collectAnswers();
      hide(qaModal);
      qaForm.removeEventListener('submit', onSubmit);
      qaCancel?.removeEventListener('click', onCancel);
      resolve(answers); // may be {}
    };
    const onCancel = (ev) => {
      ev.preventDefault();
      hide(qaModal);
      qaForm.removeEventListener('submit', onSubmit);
      qaCancel?.removeEventListener('click', onCancel);
      resolve({}); // send empty object; worker will continue with no cues
    };

    qaForm.addEventListener('submit', onSubmit);
    qaCancel?.addEventListener('click', onCancel);
  });
}

// --- main flow ---
async function suggestFlow() {
  const orgName = decodeURIComponent(orgSelect.value || '');
  const snippet  = (snippetEl.value || '').trim();
  const pcp      = !!pcpOnRecord.checked;

  if (!orgName || !snippet) {
    alert('Select an organization and paste a report snippet.');
    return;
  }

  commsMeta.textContent = 'Thinking with OpenAI…';
  composerOut.value = '';
  ruleOut.innerHTML = '—';

  try {
    let payload = { orgName, pcpOnRecord: pcp, snippet };

    // 1st call — may return needsQuestions
    let r = await fetch(`${API_BASE}/suggest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    let j = await r.json();
    if (j.error) throw new Error(j.error);

    // If worker requests Q&A, show modal and re-call with answers
    if (j.needsQuestions && Array.isArray(j.questions)) {
      const answers = await showQAModalAndCollect(j.questions);
      payload = { ...payload, answers };
      r = await fetch(`${API_BASE}/suggest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      j = await r.json();
      if (j.error) throw new Error(j.error);
    }

    // Render final result
    const rule = j.chosenRule || {};
    const routing = j.routing || {};
    const message = j.message || {};

    ruleOut.innerHTML = `
      <div><b>${escapeHtml(rule.Finding || '(unknown rule)')}</b>
        ${rule.Severity ? `<span class="badge ${String(rule.Severity).toLowerCase()}">${escapeHtml(rule.Severity)}</span>` : ''}
      </div>
      <div style="margin-top:6px"><i>Condition:</i> ${escapeHtml(rule.Condition || '—')}</div>
      <div style="margin-top:6px"><i>Recommendation:</i> ${escapeHtml(rule.Recommendation || '—')}</div>
    `;

    commsMeta.textContent =
      `${routing.channel || '?'} → ${routing.recipient || '?'} ${routing.templateName ? `| ${routing.templateName}` : ''}`;

    const ctx = {
      orgName,
      specialist: routing.specialist || '',
      snippet,
      finding: rule.Finding || '',
      recommendation: rule.Recommendation || ''
    };
    const subject = fillFields(message.subject || '', ctx);
    const body    = fillFields(message.body || '', ctx);
    composerOut.value = (subject ? `Subject: ${subject}\n\n` : '') + body;

    // helpers
    const blob = new Blob([composerOut.value], { type: 'text/plain' });
    downloadTxt.href = URL.createObjectURL(blob);
    const mSubject = encodeURIComponent(subject || 'Incidental finding');
    const mBody    = encodeURIComponent(composerOut.value);
    mailtoBtn.href = `mailto:?subject=${mSubject}&body=${mBody}`;

  } catch (e) {
    commsMeta.textContent = `Error: ${e.message}`;
  }
}

// --- wire up ---
reloadBtn?.addEventListener('click', (e) => { e.preventDefault(); loadOrgs(); });
suggestBtn?.addEventListener('click', (e) => { e.preventDefault(); suggestFlow(); });
copyBtn?.addEventListener('click', async (e) => { e.preventDefault(); try { await navigator.clipboard.writeText(composerOut.value || ''); } catch {} });

// Boot
loadOrgs();
