// script.js (ESM)

const DATA_URL = './data/cases.json';

// --- State ---
let allCases = [];
let filtered = [];
let selected = null;

// --- DOM ---
const tbody = document.getElementById('casesTbody');
const emptyState = document.getElementById('emptyState');
const filterBodyPart = document.getElementById('filterBodyPart');
const filterSeverity = document.getElementById('filterSeverity');
const searchBox = document.getElementById('searchBox');
const reloadBtn = document.getElementById('reloadBtn');
const downloadCsv = document.getElementById('downloadCsv');

const composerOut = document.getElementById('composerOut');
const copyBtn = document.getElementById('copyBtn');
const downloadTxt = document.getElementById('downloadTxt');
const mailtoBtn = document.getElementById('mailtoBtn');
document.querySelectorAll('.templateBtn').forEach(btn =>
  btn.addEventListener('click', () => generateTemplate(btn.dataset.template))
);

// --- Utilities ---
const fmtDate = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d)) return iso;
  return d.toLocaleDateString();
};
const esc = s => (s ?? '').toString();

function mapCaseFields(row) {
  // 🔁 Adjust this mapper if your JSON keys differ.
  // Expected shape per row (examples in /data/cases.json):
  // {
  //   id, patientName, mrn, bodyPart, finding, recommendation,
  //   severity, due, pcpName, pcpEmail
  // }
  return {
    id: row.id,
    patientName: row.patientName,
    mrn: row.mrn,
    bodyPart: row.bodyPart,
    finding: row.finding,
    recommendation: row.recommendation,
    severity: row.severity, // Red | Amber | Green
    due: row.due,           // ISO date
    pcpName: row.pcpName,
    pcpEmail: row.pcpEmail || '',
  };
}

function toCsv(rows) {
  const headers = [
    'id','patientName','mrn','bodyPart','finding','recommendation','severity','due','pcpName','pcpEmail'
  ];
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

// --- Rendering ---
function renderTable(rows) {
  tbody.innerHTML = '';
  if (!rows.length) {
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

    const patient = document.createElement('td');
    patient.textContent = r.patientName || '';
    tr.appendChild(patient);

    const mrn = document.createElement('td');
    mrn.textContent = r.mrn || '';
    tr.appendChild(mrn);

    const bp = document.createElement('td');
    bp.textContent = r.bodyPart || '';
    tr.appendChild(bp);

    const finding = document.createElement('td');
    finding.textContent = r.finding || '';
    tr.appendChild(finding);

    const rec = document.createElement('td');
    rec.textContent = r.recommendation || '';
    tr.appendChild(rec);

    const due = document.createElement('td');
    due.textContent = fmtDate(r.due);
    tr.appendChild(due);

    const pcp = document.createElement('td');
    pcp.textContent = r.pcpName || '';
    tr.appendChild(pcp);

    const actions = document.createElement('td');
    const pick = document.createElement('button');
    pick.textContent = 'Select';
    pick.addEventListener('click', () => {
      selected = r;
      highlightSelected(tr);
    });
    actions.appendChild(pick);
    tr.appendChild(actions);

    tbody.appendChild(tr);
  }
}

function highlightSelected(tr) {
  tbody.querySelectorAll('tr').forEach(row => row.style.outline = '');
  tr.style.outline = '2px solid var(--accent)';
}

// --- Filtering ---
function applyFilters() {
  const term = searchBox.value.trim().toLowerCase();
  const bp = filterBodyPart.value;
  const sev = filterSeverity.value;

  filtered = allCases.filter(r => {
    if (bp && r.bodyPart !== bp) return false;
    if (sev && r.severity !== sev) return false;
    if (!term) return true;
    const hay = `${r.patientName} ${r.mrn} ${r.bodyPart} ${r.finding} ${r.recommendation} ${r.pcpName}`.toLowerCase();
    return hay.includes(term);
  });

  renderTable(filtered);
  const csv = toCsv(filtered);
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadCsv.href = URL.createObjectURL(blob);
}

// --- Data load ---
async function loadData() {
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch ${DATA_URL}`);
  const raw = await res.json();
  allCases = raw.map(mapCaseFields);
  populateBodyPartFilter(allCases);
  applyFilters();
}

function populateBodyPartFilter(rows) {
  const opts = new Set(rows.map(r => r.bodyPart).filter(Boolean));
  filterBodyPart.innerHTML = '<option value="">All</option>' +
    [...opts].sort().map(v => `<option value="${v}">${v}</option>`).join('');
}

// --- Templates ---
const templates = {
  patientLetter: (r) => `
Dear ${esc(r.patientName)},

Your recent imaging showed an incidental finding involving the ${esc(r.bodyPart)}:
"${esc(r.finding)}".

Recommendation: ${esc(r.recommendation || 'Follow clinical guidelines / provider judgment')}.
Suggested follow-up date: ${fmtDate(r.due)}.

Please contact your primary care provider${r.pcpName ? ` (${esc(r.pcpName)})` : ''} to arrange follow-up.
If you have questions, reply to this message or call our navigation team.

Sincerely,
Navigator Team
  `.trim(),

  pcpLetter: (r) => `
To: ${esc(r.pcpName)}${r.pcpEmail ? ` <${esc(r.pcpEmail)}>` : ''}

Subject: Incidental ${esc(r.bodyPart)} finding — ${esc(r.patientName)} (${esc(r.mrn)})

Patient ${esc(r.patientName)} (${esc(r.mrn)}) has an incidental ${esc(r.bodyPart)} finding:
"${esc(r.finding)}".

Recommendation: ${esc(r.recommendation || 'Per guideline; please advise')}.
Suggested due: ${fmtDate(r.due)}.

Kindly review and consider ordering appropriate follow-up.
  `.trim(),

  inBasket: (r) => `
FYI: ${esc(r.patientName)} (${esc(r.mrn)}) — incidental ${esc(r.bodyPart)} finding:
"${esc(r.finding)}"; rec: ${esc(r.recommendation)}; due: ${fmtDate(r.due)}.
  `.trim(),

  faxCover: (r) => `
FAX COVER — Incidental Finding

To: ${esc(r.pcpName)}
Re: ${esc(r.patientName)} (${esc(r.mrn)})
Finding: ${esc(r.finding)} — ${esc(r.bodyPart)}
Recommendation: ${esc(r.recommendation)}
Due: ${fmtDate(r.due)}

Notes: Please review and schedule indicated follow-up.
  `.trim(),
};

function generateTemplate(key) {
  if (!selected) {
    alert('Select a case first (click “Select” in the table).');
    return;
  }
  const fn = templates[key];
  const text = fn ? fn(selected) : '';
  composerOut.value = text;

  // Update download + mailto
  const blob = new Blob([text], { type: 'text/plain' });
  downloadTxt.href = URL.createObjectURL(blob);

  const subject = encodeURIComponent(`Incidental finding — ${selected.patientName} (${selected.mrn})`);
  const body = encodeURIComponent(text);
  const addr = selected.pcpEmail ? `mailto:${encodeURIComponent(selected.pcpEmail)}` : 'mailto:';
  mailtoBtn.href = `${addr}?subject=${subject}&body=${body}`;
}

// --- Events ---
[filterBodyPart, filterSeverity].forEach(el => el.addEventListener('change', applyFilters));
searchBox.addEventListener('input', applyFilters);
reloadBtn.addEventListener('click', () => loadData());
copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(composerOut.value || '');
});

// --- Boot ---
loadData().catch(err => {
  console.error(err);
  emptyState.style.display = 'block';
  emptyState.textContent = 'Failed to load /data/cases.json. Add the file and try again.';
});
