// IMPORTANT: This code runs on a server, not in the browser.
// It's safe to use API keys here because they are stored as environment variables.

// CORRECTED: Import the official smartsheet-javascript-sdk
const smartsheetSdk = require('smartsheet-javascript-sdk');

// We need the openai client to talk to OpenAI
const OpenAI = require('openai');

// CORRECTED: Initialize the Smartsheet client using the official SDK
const smartsheetClient = smartsheetSdk.createClient({
    accessToken: process.env.SMARTSHEET_ACCESS_TOKEN
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// --- CONFIGURATION FOR YOUR SMARTSHEET ---
const ORGS_SHEET_ID = process.env.SMARTSHEET_ORGS_SHEET_ID;
const RULES_SHEET_ID = process.env.SMARTSHEET_RULES_SHEET_ID;
const TEMPLATES_SHEET_ID = process.env.SMARTSHEET_TEMPLATES_SHEET_ID;

// The main function that Netlify will run
exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { action, ...data } = JSON.parse(event.body);

        // This acts like a router. Based on the 'action', it calls a different function.
        switch (action) {
            case 'getOrgs':
                const orgs = await getOrganizations();
                return { statusCode: 200, body: JSON.stringify(orgs) };
            
            case 'analyzeSnippet':
                const result = await analyzeSnippet(data);
                return { statusCode: 200, body: JSON.stringify(result) };

            default:
                return { statusCode: 400, body: JSON.stringify({ message: 'Invalid action.' }) };
        }
    } catch (error) {
        console.error("Error in serverless function:", error);
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};

// --- HELPER FUNCTIONS ---

// Fetches the list of organizations from Smartsheet
async function getOrganizations() {
    const options = { id: ORGS_SHEET_ID };
    // CORRECTED: Use the new client variable
    const sheet = await smartsheetClient.sheets.getSheet(options);
    // Map the sheet rows to a cleaner JSON format
    return sheet.rows.map(row => ({
        id: row.id,
        name: row.cells.find(c => c.columnId === sheet.columns[0].id)?.value || 'Unnamed Org'
    }));
}

// The main analysis logic
async function analyzeSnippet({ orgId, hasPCP, snippet }) {
    // 1. Fetch all rules and org details from Smartsheet in parallel
    const [allRules, orgDetails] = await Promise.all([
        // CORRECTED: Use the new client variable
        smartsheetClient.sheets.getSheet({ id: RULES_SHEET_ID }),
        getOrgDetails(orgId)
    ]);

    // 2. Use OpenAI to classify the snippet and match it to a rule
    const matchedRuleId = await classifySnippetWithOpenAI(snippet, allRules);
    if (!matchedRuleId) {
        throw new Error('OpenAI could not confidently match the snippet to a known rule.');
    }

    const matchedRuleRow = allRules.rows.find(row => {
        const ruleIdCell = row.cells.find(c => c.columnId === allRules.columns[0].id);
        return ruleIdCell?.value === matchedRuleId;
    });

    if (!matchedRuleRow) {
        throw new Error(`Matched rule ID ${matchedRuleId} not found in Smartsheet.`);
    }
    
    // Convert the matched Smartsheet row into a simple object
    const matchedRule = formatRowToObject(matchedRuleRow, allRules.columns);

    // 3. Determine the final action plan and communication strategy
    const actionPlan = matchedRule.Recommendation;

    const communication = await selectCommunicationTemplate({
        orgDetails,
        hasPCP,
        severity: matchedRule.Severity
    });

    return {
        matchedRule,
        actionPlan,
        communication
    };
}

// Uses OpenAI's function calling/JSON mode to get a structured response
async function classifySnippetWithOpenAI(snippet, rulesSheet) {
    const ruleChoices = rulesSheet.rows.map(row => {
        const id = row.cells.find(c => c.columnId === rulesSheet.columns[0].id)?.value;
        const condition = row.cells.find(c => c.columnId === rulesSheet.columns[3].id)?.value;
        return `${id}: ${condition}`;
    });
    
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: "You are an expert system for a healthcare navigator. Your task is to analyze a snippet from a radiology report and strictly match it to ONE of the provided rule IDs based on its description. Respond ONLY with the matching RuleID in the specified JSON format."
                },
                {
                    role: "user",
                    content: `Here is the report snippet:\n\n"${snippet}"\n\nHere are the possible rules:\n\n${ruleChoices.join('\n')}\n\nWhich rule ID best matches the snippet?`
                }
            ],
            response_format: {
                type: "json_object",
                schema: {
                    type: "object",
                    properties: {
                        matchedRuleId: {
                            type: "string",
                            description: "The single best RuleID that matches the user's snippet."
                        }
                    },
                    required: ["matchedRuleId"]
                }
            }
        });
        const result = JSON.parse(response.choices[0].message.content);
        return result.matchedRuleId;
    } catch (error) {
        console.error("OpenAI API call failed:", error);
        throw new Error("Failed to get a classification from the AI model.");
    }
}

// Selects the right communication template based on the situation
async function selectCommunicationTemplate({ orgDetails, hasPCP, severity }) {
    // CORRECTED: Use the new client variable
    const templatesSheet = await smartsheetClient.sheets.getSheet({ id: TEMPLATES_SHEET_ID });
    const templates = templatesSheet.rows.map(row => formatRowToObject(row, templatesSheet.columns));

    let channel, recipient;

    if (orgDetails.allowsInBasket && hasPCP) {
        channel = 'In-Basket';
        recipient = 'PCP';
    } else if (hasPCP) {
        channel = 'Fax';
        recipient = 'PCP';
    } else {
        channel = 'Fax';
        recipient = 'Ordering Provider';
    }
    
    let chosenTemplate = templates.find(t => t.Channel === channel && t.Recipient === recipient);
    
    if (!chosenTemplate) {
        chosenTemplate = templates.find(t => t.Channel === 'Fax') || templates[0];
    }
    
    return {
        templateName: chosenTemplate.TemplateName,
        channel: chosenTemplate.Channel,
        body: chosenTemplate.Body
    };
}

// Utility to get details for a specific org
async function getOrgDetails(orgId) {
    // CORRECTED: Use the new client variable
    const sheet = await smartsheetClient.sheets.getSheet({ id: ORGS_SHEET_ID });
    const orgRow = sheet.rows.find(row => row.id == orgId);
    if (!orgRow) throw new Error('Organization not found.');
    
    const allowsInBasketColId = sheet.columns.find(c => c.title === 'AllowsInBasket').id;
    return {
        allowsInBasket: orgRow.cells.find(c => c.columnId === allowsInBasketColId)?.value || false
    };
}

// Utility to convert a Smartsheet row into a simple key-value object
function formatRowToObject(row, columns) {
    const obj = {};
    columns.forEach(column => {
        const cell = row.cells.find(c => c.columnId === column.id);
        const key = column.title.replace(/\s+/g, '');
        if (cell) {
            obj[key] = cell.value;
        }
    });
    return obj;
}
