document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    // IMPORTANT: Replace this with the actual URL of your serverless function
    // that you will create in Section 5.
    const API_PROXY_URL = 'YOUR_SERVERLESS_FUNCTION_URL_HERE';

    // --- DOM ELEMENT REFERENCES ---
    const orgSelect = document.getElementById('org-select');
    const pcpCheckbox = document.getElementById('pcp-checkbox');
    const reportSnippet = document.getElementById('report-snippet');
    const analyzeButton = document.getElementById('analyze-button');
    const resultsSection = document.getElementById('results-section');
    const resultsContent = document.getElementById('results-content');
    const loader = document.getElementById('loader');
    const errorMessage = document.getElementById('error-message');
    
    const matchedRuleP = document.getElementById('matched-rule');
    const matchedConditionP = document.getElementById('matched-condition');
    const matchedSeverityP = document.getElementById('matched-severity');
    const actionPlanP = document.getElementById('action-plan');
    const communicationChannelP = document.getElementById('communication-channel');
    const templateNameEl = document.getElementById('template-name');
    const communicationTemplateEl = document.getElementById('communication-template');
    const copyButton = document.getElementById('copy-button');

    // --- INITIALIZATION ---
    
    // Fetch the list of organizations when the page loads
    async function initializeApp() {
        try {
            const response = await fetch(API_PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getOrgs' }),
            });

            if (!response.ok) {
                throw new Error(`Network response was not ok, status: ${response.status}`);
            }

            const orgs = await response.json();
            
            orgSelect.innerHTML = '<option value="">-- Select an Organization --</option>'; // Clear loading text
            orgs.forEach(org => {
                const option = document.createElement('option');
                option.value = org.id;
                option.textContent = org.name;
                orgSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Failed to initialize organizations:', error);
            orgSelect.innerHTML = '<option value="">Could not load organizations</option>';
            showError('Failed to load initial data. Please check the connection and refresh the page.');
        }
    }

    // --- EVENT LISTENERS ---

    analyzeButton.addEventListener('click', handleAnalysis);
    copyButton.addEventListener('click', copyTemplateToClipboard);

    // --- CORE LOGIC ---

    async function handleAnalysis() {
        // 1. Validate input
        const selectedOrgId = orgSelect.value;
        const snippet = reportSnippet.value.trim();

        if (!selectedOrgId || !snippet) {
            alert('Please select an organization and provide a report snippet.');
            return;
        }

        // 2. Show loading state and hide previous results
        showLoading(true);
        showError(null);

        // 3. Prepare data and call the API proxy
        const requestData = {
            action: 'analyzeSnippet',
            orgId: selectedOrgId,
            hasPCP: pcpCheckbox.checked,
            snippet: snippet,
        };

        try {
            const response = await fetch(API_PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `API Error: ${response.status}`);
            }

            const result = await response.json();
            
            // 4. Display the results
            displayResults(result);

        } catch (error) {
            console.error('Analysis failed:', error);
            showError(`An error occurred during analysis: ${error.message}`);
        } finally {
            // 5. Hide loading state
            showLoading(false);
        }
    }

    function displayResults(data) {
        if (!data || !data.matchedRule) {
             showError("Could not determine a clear action plan from the provided snippet. Please provide more context.");
             return;
        }
        
        // Populate the UI elements with the data from the proxy
        matchedRuleP.querySelector('span').textContent = data.matchedRule.Finding || 'N/A';
        matchedConditionP.querySelector('span').textContent = data.matchedRule.Condition || 'N/A';
        
        const severity = data.matchedRule.Severity || 'N/A';
        const severityEl = matchedSeverityP.querySelector('span');
        severityEl.textContent = severity;
        severityEl.className = `severity-${severity.toLowerCase()}`; // For potential color coding

        actionPlanP.querySelector('span').textContent = data.actionPlan || 'N/A';
        communicationChannelP.querySelector('span').textContent = data.communication.channel || 'N/A';

        templateNameEl.textContent = data.communication.templateName || 'Template';
        
        // Render template with placeholders
        let renderedBody = data.communication.body || 'No template available.';
        const placeholders = {
            '{{patientName}}': '[Patient Name]',
            '{{patientMRN}}': '[Patient MRN]',
            '{{patientDOB}}': '[Patient DOB]',
            '{{pcpName}}': '[PCP Name]',
            '{{studyType}}': '[Study Type]',
            '{{studyDate}}': '[Study Date]',
            '{{reportSnippet}}': `"${reportSnippet.value.trim()}"`,
            '{{findingDescription}}': data.matchedRule.Finding,
            '{{recommendation}}': data.actionPlan,
            '{{navigatorName}}': '[Your Name]',
            '{{navigatorContact}}': '[Your Contact Info]',
            '{{currentDate}}': new Date().toLocaleDateString(),
            '{{orgName}}': orgSelect.options[orgSelect.selectedIndex].text,
            '{{patientAddress}}': '[Patient Address]',
        };

        for (const [key, value] of Object.entries(placeholders)) {
            renderedBody = renderedBody.replace(new RegExp(key, 'g'), value);
        }
        communicationTemplateEl.textContent = renderedBody;

        resultsContent.classList.remove('hidden');
    }

    // --- UTILITY FUNCTIONS ---

    function showLoading(isLoading) {
        resultsSection.classList.remove('hidden');
        if (isLoading) {
            loader.classList.remove('hidden');
            resultsContent.classList.add('hidden');
            analyzeButton.disabled = true;
            analyzeButton.textContent = 'Analyzing...';
        } else {
            loader.classList.add('hidden');
            analyzeButton.disabled = false;
            analyzeButton.textContent = 'Analyze Snippet';
        }
    }

    function showError(message) {
        resultsContent.classList.add('hidden');
        if (message) {
            errorMessage.textContent = message;
            errorMessage.classList.remove('hidden');
        } else {
            errorMessage.classList.add('hidden');
        }
    }

    function copyTemplateToClipboard() {
        const textToCopy = communicationTemplateEl.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            copyButton.textContent = 'Copied!';
            setTimeout(() => {
                copyButton.textContent = 'Copy Text';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Could not copy text to clipboard.');
        });
    }

    // --- START THE APP ---
    initializeApp();
});
