// Final version with improved OpenAI prompting for better inference.
const smartsheet = require('smartsheet');
const OpenAI = require('openai');

const smartsheetClient = smartsheet.createClient({
    accessToken: process.env.SMARTSHEET_ACCESS_TOKEN
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// --- CONFIGURATION ---
const ORGS_SHEET_ID = process.env.SMARTSHEET_ORGS_SHEET_ID;
const RULES_SHEET_ID = process.env.SMARTSHEET_RULES_SHEET_ID;
const TEMPLATES_SHEET_ID = process.env.SMARTSHEET_TEMPLATES_SHEET_ID;

// --- CORS HEADERS ---
const headers = {
  'Access-Control-Allow-Origin': 'https://delphidata.github.io',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Main handler function
exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS preflight successful' }) };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }
    try {
        const { action, ...data } = JSON.parse(event.body);
        let responseBody;
        switch (action) {
            case 'getOrgs':
                responseBody = await getOrganizations();
                break;
            case 'analyzeSnippet':
                responseBody = await analyzeSnippet(data);
                break;
            default:
                return { statusCode: 400, headers, body: JSON.stringify({ message: 'Invalid action.' }) };
        }
        return { statusCode: 200, headers, body: JSON.stringify(responseBody) };
    } catch (error) {
        console.error("Error in serverless function:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ message: error.message }) };
    }
};

// --- HELPER FUNCTIONS ---

async function getOrganizations() {
    const sheet = await smartsheetClient.sheets.getSheet({ id: ORGS_SHEET_ID });
    return sheet.rows.map(row => {
        const nameCell = row.cells.find(c => c.columnId === sheet.columns[0].id);
        return { id: row.id, name: nameCell ? nameCell.value : 'Unnamed Org' };
    });
}

async function analyzeSnippet({ orgId, hasPCP, snippet }) {
    const allRules = await smartsheetClient.sheets.getSheet({ id: RULES_SHEET_ID });
    
    // Pass the snippet and the rules to our improved OpenAI function
    const matchedRuleId = await classifySnippetWithOpenAI(snippet, allRules);
    
    if (!matchedRuleId) {
        throw new Error('OpenAI could not confidently match the snippet to a known rule.');
    }

    const matchedRuleRow = allRules.rows.find(row => {
        const ruleIdCell = row.cells.find(c => c.columnId === allRules.columns[0].id);
        return String(ruleIdCell?.value) === String(matchedRuleId);
    });

    if (!matchedRuleRow) {
        throw new Error(`AI returned rule ID ${matchedRuleId}, but it was not found in Smartsheet.`);
    }
    
    const matchedRule = formatRowToObject(matchedRuleRow, allRules.columns);
    const orgDetails = await getOrgDetails(orgId);
    const communication = await selectCommunicationTemplate({ orgDetails, hasPCP });

    return {
        matchedRule,
        actionPlan: matchedRule.Recommendation,
        communication
    };
}

// ***** THIS IS THE UPDATED FUNCTION *****
async function classifySnippetWithOpenAI(snippet, rulesSheet) {
    const ruleChoices = rulesSheet.rows.map(row => {
        const id = row.cells.find(c => c.columnId === rulesSheet.columns[0].id)?.value;
        const condition = row.cells.find(c => c.columnId === rulesSheet.columns[3].id)?.value;
        return `${id}: ${condition}`;
    });
    
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            temperature: 0, // Keep temperature at 0 for deterministic results
            messages: [
                {
                    role: "system",
                    content: "You are an expert clinical decision support system for a healthcare navigator. Your critical task is to analyze a snippet from a radiology report and determine the single most appropriate clinical rule to apply from a given list. The snippet may not be a perfect textual match, so you must use your clinical reasoning to select the rule that is the BEST FIT based on the finding's severity, location, and characteristics. Your response MUST be a JSON object containing only the single best `matchedRuleId`."
                },
                {
                    role: "user",
                    content: `Analyze the following radiology report snippet and select the single best-fitting rule ID from the list provided.\n\nSnippet: "${snippet}"\n\nRules:\n${ruleChoices.join('\n')}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        if (!content) return null;

        const result = JSON.parse(content);
        // Ensure the model actually returns a value for the ID
        return result.matchedRuleId || null; 

    } catch (error) {
        console.error("OpenAI API call failed:", error);
        throw new Error("Failed to get a classification from the AI model.");
    }
}


async function selectCommunicationTemplate({ orgDetails, hasPCP }) {
    const templatesSheet = await smartsheetClient.sheets.getSheet({ id: TEMPLATES_SHEET_ID });
    const templates = templatesSheet.rows.map(row => formatRowToObject(row, templatesSheet.columns));
    
    let channel, recipient;
    if (orgDetails.allowsInBasket && hasPCP) {
        channel = 'In-Basket';
        recipient = 'PCP';
    } else {
        channel = 'Fax';
        recipient = hasPCP ? 'PCP' : 'Ordering Provider';
    }
    
    let chosenTemplate = templates.find(t => t.Channel === channel && t.Recipient === recipient);
    if (!chosenTemplate) {
        // Fallback logic
        chosenTemplate = templates.find(t => t.Channel === 'Fax') || templates[0];
    }
    
    return {
        templateName: chosenTemplate.TemplateName,
        channel: chosenTemplate.Channel,
        body: chosenTemplate.Body
    };
}

async function getOrgDetails(orgId) {
    const sheet = await smartsheetClient.sheets.getSheet({ id: ORGS_SHEET_ID });
    const orgRow = sheet.rows.find(row => String(row.id) === String(orgId));
    if (!orgRow) throw new Error('Organization not found.');
    
    const allowsInBasketCol = sheet.columns.find(c => c.title === 'AllowsInBasket');
    if (!allowsInBasketCol) throw new Error('Column "AllowsInBasket" not found in Orgs sheet.');

    const allowsInBasketCell = orgRow.cells.find(c => c.columnId === allowsInBasketCol.id);
    return {
        allowsInBasket: allowsInBasketCell ? allowsInBasketCell.value : false
    };
}

function formatRowToObject(row, columns) {
    const obj = {};
    columns.forEach(column => {
        const cell = row.cells.find(c => c.columnId === column.id);
        const key = column.title.replace(/\s+/g, '');
        if (cell && cell.value !== undefined) {
            obj[key] = cell.value;
        }
    });
    return obj;
}
