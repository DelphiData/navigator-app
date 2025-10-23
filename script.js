// === CONFIG: set this to your Cloudflare Worker URL ===
const API_BASE = "https://navigator-relay.ljbarg0.workers.dev";

// DOM
const orgSelect = document.getElementById('orgSelect');
const pcpOnRecord = document.getElementById('pcpOnRecord');
const snippetEl = document.getElementById('snippet');
const suggestBtn = document.getElementById('suggestBtn');
const reloadBtn = document.getElementById('reloadBtn');

const ruleOut = document.getElementById('ruleOut');
const commsMeta = document.getElementById('commsMeta');
const composerOut = document.getElementById('composerOut');
const copyBtn = document.getElementById('copyBtn');
const downloadTxt = document.getElementById('downloadTxt');
const mailtoBtn = document.getElementById('mailtoBtn');

async function loadOrgs() {
  orgSelect.innerHTML = `<option>Loading…</option>`;
  try {
    const r = await fetch(`${API_BASE}/orgs`, { cache: 'no-store' });
    const j = await r.json();
    const orgs = j.orgs || [];
    orgSelect.innerHTML = `<option value="">Select org…</option>` +
      orgs.map(o => `<option value="${encodeURIComponent(o.OrgName)}">${o.OrgName}</option>`).join('');
  } catch (e) {
    orgSelect.innerHTML = `<option>Error loading orgs</option>`;
  }
}

reloadBtn?.addEventListener('click', loadOrgs);

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

// central renderer so we don't duplicate logic
function renderSuggestion(j, { orgName, snippet }) {
  const rule = j.chosenRule || {};
  const routing = j.routing || {};
  const message = j.message || {};

  ruleOut.innerHTML = `
    <div><b>${rule.Finding || '(unknown rule)'}</b> ${rule.Severity ? `<span class="badge ${String(rule.Severity).toLowerCase()}">${rule.Severity}</span>` : ''}</div>
    <div style="margin-top:6px"><i>Condition:</i> ${rule.Condition || '—'}</div>
    <div style="margin-top:6px"><i>Recommendation:</i> ${rule.Recommendation || '—'}</div>
  `;

  commsMeta.textContent = `${routing.channel || '?'} → ${routing.recipient || '?'} ${routing.templateName ? `| ${routing.templateName}` : ''}`;

  const ctx = {
    orgName,
    specialist: routing.specialist || '',
    snippet,
    finding: rule.Finding || '',
    recommendation: rule.Recommendation || ''
  };
  const subject = fillFields(message.subject || '', ctx);
  const body = fillFields(message.body || '', ctx);
  composerOut.value = (subject ? `Subject: ${subject}\n\n` : '') + body;

  const blob = new Blob([composerOut.value], { type: 'text/plain' });
  downloadTxt.href = URL.createObjectURL(blob);
  const mSubject = encodeURIComponent(subject || 'Incidental finding');
  const mBody = encodeURIComponent(composerOut.value);
  mailtoBtn.href = `mailto:?subject=${mSubject}&body=${mBody}`;
}

suggestBtn?.addEventListener('click', async () => {
  const orgName = decodeURIComponent(orgSelect.value || '');
  const snippet = (snippetEl.value || '').trim();
  const pcp = !!pcpOnRecord.checked;

  if (!orgName || !snippet) {
    alert('Select an organization and paste a report snippet.');
    return;
  }

  commsMeta.textContent = 'Thinking with OpenAI…';
  composerOut.value = '';
  ruleOut.innerHTML = '—';

  try {
    // First call
    const r = await fetch(`${API_BASE}/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName, pcpOnRecord: pcp, snippet })
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error);

    // If Worker says we need extra answers, prompt and re-call
    if (j.needsQuestions && Array.isArray(j.questions)) {
      const answers = {};
      for (const q of j.questions) {
        let val;
        if (q.type === 'number') {
          const raw = prompt(`${q.label}:`, '0');
          val = raw === null ? null : Number(raw);
        } else if (q.type === 'boolean') {
          val = confirm(`${q.label} (OK = Yes, Cancel = No)`);
        } else {
          val = prompt(`${q.label}:`, '');
          if (val === null) val = '';
        }
        answers[q.id] = val;
      }

      const r2 = await fetch(`${API_BASE}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName, pcpOnRecord: pcp, snippet, answers })
      });
      const j2 = await r2.json();
      if (j2.error) throw new Error(j2.error);

      renderSuggestion(j2, { orgName, snippet });
      return;
    }

    // Otherwise render the final suggestion directly
    renderSuggestion(j, { orgName, snippet });

  } catch (e) {
    commsMeta.textContent = `Error: ${e.message}`;
  }
});

// Boot
loadOrgs();
copyBtn?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(composerOut.value || ''); } catch {}
});
