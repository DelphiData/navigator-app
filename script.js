document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

const API_PROXY_URL = 'https://iridescent-sundae-0a595d.netlify.app/.netlify/functions/api';

// --- Element Selectors ---
const orgSelect = document.getElementById('org-select');
const pcpCheckbox = document.getElementById('pcp-checkbox');
const snippetTextarea = document.getElementById('snippet-textarea');
const analyzeButton = document.getElementById('analyze-button');
const loader = document.getElementById('loader');
const resultsContainer = document.getElementById('results');
const errorContainer = document.getElementById('error');

async function initializeApp() {
    if (!orgSelect || !analyzeButton || !snippetTextarea) {
        console.error("Critical HTML elements are missing. Check IDs in index.html.");
        displayError("Application failed to load. Please contact support.");
        return;
    }

    try {
        const response = await fetch(API_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getOrgs' })
        });
        if (!response.ok) throw new Error('Could not retrieve organizations.');
        
        const orgs = await response.json();
        
        orgSelect.innerHTML = '<option value="">Select an organization...</option>';
        orgs.forEach(org => {
            const option = document.createElement('option');
            option.value = org.id;
            option.textContent = org.name;
            orgSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Initialization failed:", error);
        orgSelect.innerHTML = '<option value="">Could not load organizations</option>';
        displayError(`Failed to initialize: ${error.message}`);
    }
}

analyzeButton.addEventListener('click', async () => {
    const selectedOrgId = orgSelect.value;
    const hasPCP = pcpCheckbox.checked;
    const snippet = snippetTextarea.value; // This is line 48

    if (!selectedOrgId || !snippet) {
        displayError('Please select an organization and enter a report snippet.');
        return;
    }

    loader.style.display = 'block';
    resultsContainer.style.display = 'none';
    errorContainer.style.display = 'none';
    analyzeButton.disabled = true;

    try {
        const response = await fetch(API_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'analyzeSnippet',
                orgId: selectedOrgId,
                hasPCP: hasPCP,
                snippet: snippet
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'An unknown error occurred.');
        }
        const data = await response.json();
        displayResults(data, snippet);
    } catch (error) {
        console.error('Analysis error:', error);
        displayError(`An error occurred during analysis: ${error.message}`);
    } finally {
        loader.style.display = 'none';
        analyzeButton.disabled = false;
    }
});

function displayResults(data, userSnippet) {
    errorContainer.style.display = 'none';
    resultsContainer.innerHTML = `
        <h3>Analysis and Recommended Plan</h3>
        <div class="result-item">
            <strong>Finding:</strong>
            <p>${userSnippet}</p>
        </div>
        <div class="result-item">
            <strong>Matched Rule Condition:</strong>
            <p>${data.matchedRule.Finding || 'N/A'}</p>
        </div>
         <div class="result-item">
            <strong>Severity Tier:</strong>
            <p>${data.matchedRule.Severity || 'N/A'}</p>
        </div>
        <div class="result-item">
            <strong>Recommendation:</strong>
            <p>${data.actionPlan || 'N/A'}</p>
        </div>
        <div class="result-item">
            <strong>Communication Plan:</strong>
            <p>Send "<strong>${data.communication.templateName}</strong>" template via <strong>${data.communication.channel}</strong>.</p>
            <textarea readonly>${data.communication.body}</textarea>
        </div>
    `;
    resultsContainer.style.display = 'block';
}

function displayError(message) {
    resultsContainer.style.display = 'none';
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
}
