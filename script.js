// script.js (ESM) — secrets never used here

// ======== existing table bits (kept minimal) ========
const DATA_URL = './data/cases.json';

let allCases = [];
let filtered = [];
let selected = null;

const tbody = document.getElementById('casesTbody');
const emptyState = document.getElementById('emptyState');
const downloadCsv = document.getElementById('downloadCsv');
const reloadBtn = document.getElementById('reloadBtn');

reloadBtn?.addEventListener('click', () => {
  loadEverything().catch(console.error);
});

function toCsv(rows) {
  if (!rows?.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) {
    const vals = headers.map(h => {
      const v = r[h] ?? '';
      return /[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
    });
    lines.push(vals.join(','));
  }
  return lines.join('\n');
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d) ? iso : d.toLocaleDateString();
}

function renderTable(rows) {
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!rows?.length) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';
  for (const r of rows) {
    const tr = document.createElement('tr');

    const status = document.createElement('td');
    const b = document.createElement('span');
    b.className = 'badge ' + (r.severity?.toLowerCase() || 'green');
    b.textContent = r.severity || 'Green';
    status.appendChild(b);
    tr.appendChild(status);

    const tds = ['patientName','mrn','bodyPart','finding','recommendation','due','pcpName'];
    for (const k of tds) {
      const td = document.createElement('td');
      td.textContent = k === 'due' ? fmtDate(r[k]) : (r[k] || '');
      tr.appendChild(td);
    }

    const act = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Select';
    btn.onclick = () => { selected = r; tr.style.outline = '2px solid var(--accent)'; };
    act.appendChild(btn);
    tr.appendChild(act);

    tbody.appendChild(tr);
  }
}

// ======== NEW: Triage Assistant logic ========
const orgSelect = document.getElementById('orgSelect');
const pcpOnRecord = document.getElementById('pcpOnRecord');
const snippetEl = document.getElementById('snippet');
const suggestBtn = document.getElementById('suggestBtn');
const ruleOut = document.getElementById('ruleOut');
const commsMeta = document.getElementById('commsMeta');
const composerOut = document.getElementById('composerOut');
const copyBtn = document.getElementById('copyBtn');
const downloadTxt = document.getElementById('downloadTxt');
const mailtoBtn = document.getElementById('mailtoBtn');

let ORGS = [];
let COMMS = [];
let RULES = [];
let RULES_EXPANDED = [];

async function loadEverything() {
  // cases.json is optional — ok if missing at first
  try {
    const raw = await fetch(DATA_URL, { cache: 'no-store' });
    if (raw.ok) {
      const arr = await raw.json();
      allCases = arr;
      filtered = arr;
      renderTable(arr);
      const csv = toCsv(arr);
      downloadCsv.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    }
  } catch (_) {}

  // required data files
  const [orgs, comms, rules, rulesEx] = await Promise.all([
    fetch('./data/navigatorOrgs.json').then(r=>r.json()),
    fetch('./data/commsTemplates.json').then(r=>r.json()),
    fetch('./data/rulesExpanded.json').then(r=>r.json()).catch(()=>[]),
    fetch('./data/rulesLibrary.json').then(r=>r.json())
  ]);

  ORGS = orgs;
  COMMS = comms;
  RULES_EXPANDED = Array.isArray(rulesEx) ? rulesEx : [];
  RULES = rules;

  populateOrgSelect(ORGS);
}

function populateOrgSelect(orgs) {
  if (!orgSelect) return;
  orgSelect.innerHTML = '<option value="">Select org…</option>' +
    orgs.map(o => `<option value="${encodeURIComponent(o.OrgName)}">${o.OrgName}</option>`).join('');
}

const BASIC_SPECIALTY_MAP = [
  { includes: ['adrenal','adrenaloma','endocrine'], specialty: 'Endocrinology' },
  { includes: ['lung','pulmonary','emphysema','nodule'], specialty: 'Pulmonology' },
  { includes: ['cac','valvular','aortic valve','coronary','calcium','cardiac'], specialty: 'Cardiology' },
  { includes: ['aneurysm','aorta','aaa','taa','iliac'], specialty: 'Vascular Surgery' },
  { includes: ['bowel','colon','ileum','appendix','gallbladder','liver','biliary','pancreas','gi','gastric'], specialty: 'Gastroenterology' },
  { includes: ['kidney','renal','urolith','ureter','bladder','prostate'], specialty: 'Urology' }
];

function guessSpecialty(snippetLower) {
  for (const m of BASIC_SPECIALTY_MAP) {
    if (m.includes.some(k => snippetLower.includes(k))) return m.specialty;
  }
  return 'Primary Care';
}

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

// Score snippet against rule keywords + some fields
function scoreRule(rule, snippet) {
  const kw = (rule.keywords && rule.keywords.length ? rule.keywords : tokenize(rule.Finding + ' ' + rule.Condition));
  const sTokens = new Set(tokenize(snippet));
  let score = 0;
  for (const w of kw) if (sTokens.has(w)) score += 2;
  // small boost if words from Finding/Condition appear
  for (const w of tokenize(rule.Finding + ' ' + rule.Condition)) if (sTokens.has(w)) score += 1;
  // severity weight: Red>Amber>Green
  const sevW = rule.Severity === 'Red' ? 2 : rule.Severity === 'Amber' ? 1 : 0;
  score += sevW;
  return score;
}

// Choose comms template by recipient priority and org capabilities
function pickTemplate({ hasPCP, org, specialty, rulesSuggestion }) {
  const orgAllowsFax = !!org?.AllowsFax;
  const candidates = COMMS.slice();

  // recipient priority
  const wanted = [];
  if (hasPCP) wanted.push('PCP');
  else wanted.push('Ordering Provider');

  // If no PCP/OP or specialty specifically recommended, allow Specialist
  wanted.push('Specialist', 'Patient');

  // Channel preference: In-Basket if exists; otherwise Fax if org allows; otherwise Letter/Phone
  const channelPref = ['In-Basket'];
  if (orgAllowsFax) channelPref.push('Fax');
  channelPref.push('Letter','Phone','Portal');

  // Try templateName heuristic if rulesSuggestion exists
  const byRuleName = rulesSuggestion?.RuleID
    ? candidates.find(t => (t.TemplateName||'').toLowerCase().includes(rulesSuggestion.RuleID.toLowerCase()))
    : null;
  if (byRuleName) return byRuleName;

  // Filter by recipient priority
  for (const rec of wanted) {
    const recMatches = candidates.filter(t => (t.Recipient||'').toLowerCase() === rec.toLowerCase());
    if (recMatches.length) {
      // among those, prefer channel order
      for (const ch of channelPref) {
        const m = recMatches.find(t => (t.Channel||'').toLowerCase() === ch.toLowerCase());
        if (m) return m;
      }
      return recMatches[0];
    }
  }
  // fallback
  return candidates[0];
}

function fillTemplateFields(text, ctx) {
  return (text || '')
    .replace(/\{\{\s*currentDate\s*\}\}/g, new Date().toLocaleDateString())
    .replace(/\{\{\s*orgName\s*\}\}/g, ctx.orgName || '')
    .replace(/\{\{\s*specialist\s*\}\}/g, ctx.specialist || '')
    .replace(/\{\{\s*pcpName\s*\}\}/g, ctx.pcpName || '{{pcpName}}')
    .replace(/\{\{\s*patientName\s*\}\}/g, ctx.patientName || '{{patientName}}')
    .replace(/\{\{\s*mrn\s*\}\}/g, ctx.mrn || '{{mrn}}')
    .trim();
}

function renderSuggestion({ rule, template, org, specialist }) {
  const ruleHtml = rule
    ? `<div><b>${rule.Finding}</b> <span class="badge ${rule.Severity?.toLowerCase()}">${rule.Severity}</span></div>
       <div style="margin-top:6px"><i>Condition:</i> ${rule.Condition || '—'}</div>
       <div style="margin-top:6px"><i>Recommendation:</i> ${rule.Recommendation || '—'}</div>`
    : 'No rule matched.';
  ruleOut.innerHTML = ruleHtml;

  if (!template) {
    commsMeta.textContent = 'No communication template matched.';
    composerOut.value = '';
    return;
  }
  const ctx = {
    orgName: org?.OrgName || '',
    specialist: specialist || '',
    pcpName: '', patientName: '', mrn: ''
  };
  const subject = fillTemplateFields(template.Subject, ctx);
  const body = fillTemplateFields(template.Body, ctx);

  commsMeta.textContent = `${template.Channel} → ${template.Recipient} | ${template.TemplateName}`;
  composerOut.value = (subject ? `Subject: ${subject}\n\n` : '') + body;

  // Download/email helpers
  const blob = new Blob([composerOut.value], { type: 'text/plain' });
  downloadTxt.href = URL.createObjectURL(blob);
  const mSubject = encodeURIComponent(subject || `Incidental finding`);
  const mBody = encodeURIComponent(composerOut.value);
  mailtoBtn.href = `mailto:?subject=${mSubject}&body=${mBody}`;
}

suggestBtn?.addEventListener('click', () => {
  const orgName = decodeURIComponent(orgSelect.value || '');
  const org = ORGS.find(o => o.OrgName === orgName) || null;
  const hasPCP = !!pcpOnRecord.checked;
  const snippet = (snippetEl.value || '').trim();
  if (!orgName || !snippet) {
    alert('Please select an organization and paste a report snippet.');
    return;
  }
  const sLower = snippet.toLowerCase();

  // Rule matching
  const pool = (RULES_EXPANDED.length ? RULES_EXPANDED : RULES);
  let best = null, bestScore = -1;
  for (const r of pool) {
    const sc = scoreRule(r, sLower);
    if (sc > bestScore) { best = r; bestScore = sc; }
  }

  // Specialist decision
  let specialist = '';
  if (best?.specialty) specialist = best.specialty;
  else specialist = guessSpecialty(sLower);

  // If org lacks that specialist, fall back to PCP/OP
  const orgHasSpecialist = org?.SpecialistsAvailable?.some(s => s.toLowerCase() === specialist.toLowerCase());
  if (!orgHasSpecialist) specialist = '';

  // Template selection
  const template = pickTemplate({ hasPCP, org, specialty: specialist, rulesSuggestion: best });

  renderSuggestion({ rule: best, template, org, specialist });
});

copyBtn?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(composerOut.value || ''); } catch {}
});

// ======== boot ========
loadEverything().catch(console.error);
