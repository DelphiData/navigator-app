document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// IMPORTANT: This is your unique serverless function URL.
const API_PROXY_URL = 'https://iridescent-sundae-0a595d.netlify.app/.netlify/functions/api';

const orgSelect = document.getElementById('org-select');
const pcpCheckbox = document.getElementById('pcp-checkbox');
const snippetTextarea = document.getElementById('snippet-textarea');
const analyzeButton = document.getElementById('analyze-button');
const loader = document.getElementById('loader');
const resultsContainer = document.getElementById('results');
const errorContainer = document.getElementById('error');

async function initializeApp() {
    try {
        const response = await fetch(API_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getOrgs' })
        });

        if (!response.ok) {
            throw new Error('Could not retrieve organizations from the server.');
        }

        const orgs = await response.json();
        
        orgSelect.innerHTML = '<option value="">Select an organization...</option>'; // Clear previous options
        orgs.forEach(org => {
            const option = document.createElement('option');
            option.value = org.id;
            option.textContent = org.name;
            orgSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Initialization failed:", error);
        orgSelect.innerHTML = '<option value="">Could not load organizations</option>';
        displayError(`Failed to initialize organizations: ${error.message}`);
    }
}

analyzeButton.addEventListener('click', async () => {
    const selectedOrgId = orgSelect.value;
    const hasPCP = pcpCheckbox.checked;
    const snippet = snippetTextarea.value;

    if (!selectedOrgId || !snippet) {
        displayError('Please select an organization and enter a report snippet.');
        return;
    }

    // Show loader and hide previous results/errors
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
            throw new Error(errorData.message || 'An unknown error occurred during analysis.');
        }

        const data = await response.json();
        // Pass the user's original snippet to the display function
        displayResults(data, snippet);

    } catch (error) {
        console.error('Analysis error:', error);
        displayError(`An error occurred during analysis: ${error.message}`);
    } finally {
        // Hide loader and re-enable button
        loader.style.display = 'none';
        analyzeButton.disabled = false;
    }
});

function displayResults(data, userSnippet) {
    // Clear previous errors
    errorContainer.style.display = 'none';

    // Populate the results container with detailed information
    resultsContainer.innerHTML = `
        <h3>Analysis and Recommended Plan</h3>
        <div class="result-item">
            <strong>Finding:</strong>
            <p>${userSnippet}</p> <!-- Display the user's actual input -->
        </div>
        <div class="result-item">
            <strong>Matched Rule Condition:</strong>
            <p>${data.matchedRule.Finding || 'N/A'}</p> <!-- Show the rule text from Smartsheet -->
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
    // Hide results and show error message
    resultsContainer.style.display = 'none';
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
}
