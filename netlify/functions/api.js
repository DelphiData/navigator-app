// IMPORTANT: This code runs on a server, not in the browser.

const smartsheet = require('smartsheet');
const OpenAI = require('openai');

const smartsheetClient = smartsheet.createClient({
    accessToken: process.env.SMARTSHEET_ACCESS_TOKEN
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// --- CONFIGURATION FOR YOUR SMARTSHEET ---
const ORGS_SHEET_ID = process.env.SMARTSHEET_ the following corrected code. I have added a new `headers` object and logic to handle the browser's preflight check.

```javascript
// IMPORTANT: This code runs on a server, not in the browser.

const smartsheet = require('smartsheet');
const OpenAI = require('openai');

const smartsheetClient = smartsheet.createClient({
    accessToken: process.env.SMARTSHEET_ACCESS_TOKEN
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// --- CONFIGURATION FOR YOUR SMARTSHEET ---
const ORGS_SHEET_ID = process.env.SMARTSHEET_ORGS_SHEET_ID;
const RULES_SHEET_ID = process.env.SMARTSHEET_RULESORGS_SHEET_ID;
const RULES_SHEET_ID = process.env.SMARTSHEET_RULES_SHEET_ID;
const TEMPLATES_SHEET_ID = process.env.SMARTSHEET__SHEET_ID;
const TEMPLATES_SHEET_ID = process.env.SMARTSHEET_TEMPLATES_SHEET_ID;

// --- CORS HEADERS ---
// This is the crucial part that givesTEMPLATES_SHEET_ID;

// --- CORS HEADERS ---
// This is the crucial part that gives your GitHub Pages site permission to access this function.
const headers = {
  'Access-Control-Allow-Origin your GitHub Pages site permission to access this function.
const headers = {
  'Access-Control-Allow-Origin': 'https://delphidata.github.io', // The URL of your frontend app
  'Access-Control-': 'https://delphidata.github.io', // The URL of your frontend app
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS' // AllowAllow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS' // Allow POST and OPTIONS requests
};


// The main function that Netlify will run
exports.handler = async (event) => {
    // The browser sends an OPTIONS request first to check if it's safe to send the real request.
    // We need to handle this "preflight" request.
    if (event.httpMethod === 'OPTIONS') {
         POST and OPTIONS requests
};


// The main function that Netlify will run
exports.handler = async (event) => {
    // The browser sends an OPTIONS request first to check if it's safe to send the real request.
    // We need to handle this "preflight" request.
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200, // OK
            headers,
            body: JSON.stringify({return {
            statusCode: 200, // OK
            headers,
            body: JSON.stringify({ message: 'CORS preflight check successful' })
        };
    }

    // Only allow POST requests for message: 'CORS preflight check successful' })
        };
    }

    // Only allow POST requests for our actual logic
    if (event.httpMethod !== 'POST') {
        return { statusCode: 40 our actual logic
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed', headers };
    }

    try {
        const { action, ...data5, body: 'Method Not Allowed', headers };
    }

    try {
        const { action, ...data } = JSON.parse(event.body);

        let responseBody;

        // This acts like a router } = JSON.parse(event.body);

        let responseBody;

        // This acts like a router. Based on the 'action', it calls a different function.
        switch (action) {
            case 'get. Based on the 'action', it calls a different function.
        switch (action) {
            case 'getOrgs':
                responseBody = await getOrganizations();
                break;
            
            case 'analyzeSnippetOrgs':
                responseBody = await getOrganizations();
                break;
            
            case 'analyzeSnippet':
                responseBody = await analyzeSnippet(data);
                break;

            default:
                return { statusCode: ':
                responseBody = await analyzeSnippet(data);
                break;

            default:
                return { statusCode: 400, headers, body: JSON.stringify({ message: 'Invalid action.' }) };
        }
400, headers, body: JSON.stringify({ message: 'Invalid action.' }) };
        }
        
        // Return a successful response with the CORS headers included.
        return { statusCode: 200,        
        // Return a successful response with the CORS headers included.
        return { statusCode: 200, headers, body: JSON.stringify(responseBody) };

    } catch (error) {
        console.error(" headers, body: JSON.stringify(responseBody) };

    } catch (error) {
        console.error("Error in serverless function:", error);
        // Return an error response with the CORS headers included.
        return {Error in serverless function:", error);
        // Return an error response with the CORS headers included.
        return { statusCode: 500, headers, body: JSON.stringify({ message: error.message }) };
     statusCode: 500, headers, body: JSON.stringify({ message: error.message }) };
    }
};

// --- HELPER FUNCTIONS (No changes needed below this line) ---

// Fetches the list}
};

// --- HELPER FUNCTIONS (No changes needed below this line) ---

// Fetches the list of organizations from Smartsheet
async function getOrganizations() {
    const options = { id: ORGS_SHEET of organizations from Smartsheet
async function getOrganizations() {
    const options = { id: ORGS_SHEET_ID };
    const sheet = await smartsheetClient.sheets.getSheet(options);
    return sheet.rows_ID };
    const sheet = await smartsheetClient.sheets.getSheet(options);
    return sheet.rows.map(row => ({
        id: row.id,
        name: row.cells.find(c => c.columnId === sheet.columns[0].id)?.value || 'Unnamed Org'
    }));
}

// The main analysis logic
async function analyzeSnippet({ orgId, hasPCP, snippet }) {
    const [allRules, orgDetails] = await Promise.all([
        smartsheetClient.sheets.getSheet({ id: RULES_SHEET_ID }),
        getOrgDetails(orgId)
    ]);

    const matched.map(row => ({
        id: row.id,
        name: row.cells.find(c => c.columnId === sheet.columns[0].id)?.value || 'Unnamed Org'
    }));
}

// The main analysis logic
async function analyzeSnippet({ orgId, hasPCP, snippet }) {
    const [allRules, orgDetails] = await Promise.all([
        smartsheetClient.sheets.getSheet({ id: RULES_SHEET_ID }),
        getOrgDetails(orgId)
    ]);

    const matchedRuleId = await classifySnippetWithOpenAI(snippet, allRules);
    if (!matchedRuleId) {RuleId = await classifySnippetWithOpenAI(snippet, allRules);
    if (!matchedRuleId) {
        throw new Error('OpenAI could not confidently match the snippet to a known rule.');
    }

    const matchedRule
        throw new Error('OpenAI could not confidently match the snippet to a known rule.');
    }

    const matchedRuleRow = allRules.rows.find(row => {
        const ruleIdCell = row.cells.find(c => c.columnId === allRules.columns[0].id);
        return ruleIdCell?.value === matchedRuleId;
    });

    if (!matchedRuleRow) {
        throw new Error(`Matched rule ID ${matchedRuleId} not found in Smartsheet.`);
    }
    
    const matchedRule =Row = allRules.rows.find(row => {
        const ruleIdCell = row.cells.find(c => c.columnId === allRules.columns[0].id);
        return ruleIdCell?.value === matchedRuleId;
    });

    if (!matchedRuleRow) {
        throw new Error(`Matched rule ID ${matchedRuleId} not found in Smartsheet.`);
    }
    
    const matchedRule = formatRowToObject(matchedRuleRow, allRules.columns);
    const actionPlan = matchedRule.Recommendation;
    const formatRowToObject(matchedRuleRow, allRules.columns);
    const actionPlan = matchedRule.Recommendation;
    const communication = await selectCommunicationTemplate({
        orgDetails,
        hasPCP,
        severity: matchedRule. communication = await selectCommunicationTemplate({
        orgDetails,
        hasPCP,
        severity: matchedRule.Severity
    });

    return {
        matchedRule,
        actionPlan,
        communication
    };
Severity
    });

    return {
        matchedRule,
        actionPlan,
        communication
    };
}

// Uses OpenAI's function calling/JSON mode to get a structured response
async function classifySnippetWithOpen}

// Uses OpenAI's function calling/JSON mode to get a structured response
async function classifySnippetWithOpenAI(snippet, rulesSheet) {
    const ruleChoices = rulesSheet.rows.map(row => {
        const id = row.cells.find(c => c.columnId === rulesSheet.columns[0].id)?.value;
        const condition = row.cells.find(c => c.columnId === rulesSheet.columns[3].id)?.value;
        return `${id}: ${condition}`;
    });
    
    try {
        constAI(snippet, rulesSheet) {
    const ruleChoices = rulesSheet.rows.map(row => {
        const id = row.cells.find(c => c.columnId === rulesSheet.columns[0].id)?.value;
        const condition = row.cells.find(c => c.columnId === rulesSheet.columns[3].id)?.value;
        return `${id}: ${condition}`;
    });
    
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo",
 response = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: "You are an expert system for a healthcare navigator. Your task is to analyze a snippet from a radiology report and strictly match it to ONE of the provided rule IDs based on its description. Respond ONLY with the matching RuleID in the specified JSON format."
                },
                {
                    role: "user",
                    content: `Here is the report snippet:\n\            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: "You are an expert system for a healthcare navigator. Your task is to analyze a snippet from a radiology report and strictly match it to ONE of the provided rule IDs based on its description. Respond ONLY with the matching RuleID in the specified JSON format."
                },
                {
                    role: "user",
                    content: `Here is the report snippet:\n\n"${snippet}"\n\nHere are the possible rules:\n\n${ruleChoices.join('\n')n"${snippet}"\n\nHere are the possible rules:\n\n${ruleChoices.join('\n')}\n\nWhich rule ID best matches the snippet?`
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
                    required: ["matchedRuleId"]}\n\nWhich rule ID best matches the snippet?`
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
        const result = JSON.parse(response.choices[0].message.
                }
            }
        });
        const result = JSON.parse(response.choices[0].message.content);
        return result.matchedRuleId;
    } catch (error) {
        console.errorcontent);
        return result.matchedRuleId;
    } catch (error) {
        console.error("OpenAI API call failed:", error);
        throw new Error("Failed to get a classification from the AI model.");("OpenAI API call failed:", error);
        throw new Error("Failed to get a classification from the AI model.");
    }
}

// Selects the right communication template based on the situation
async function selectCommunicationTemplate({ org
    }
}

// Selects the right communication template based on the situation
async function selectCommunicationTemplate({ orgDetails, hasPCP, severity }) {
    const templatesSheet = await smartsheetClient.sheets.getSheet({ id: TEMDetails, hasPCP, severity }) {
    const templatesSheet = await smartsheetClient.sheets.getSheet({ id: TEMPLATES_SHEET_ID });
    const templates = templatesSheet.rows.map(row => formatRowToObject(row, templatesSheet.columns));

    let channel, recipient;

    if (orgDetails.allowsInBasket && hasPCP) {
        channel = 'In-Basket';
        recipient = 'PCP';
    } else if (hasPCP) {
        channel = 'Fax';
        recipient = 'PCPPLATES_SHEET_ID });
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
    }';
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

// Utility
    
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
    const sheet = await smartsheet to get details for a specific org
async function getOrgDetails(orgId) {
    const sheet = await smartsheetClient.sheets.getSheet({ id: ORGS_SHEET_ID });
    const orgRow = sheet.rows.findClient.sheets.getSheet({ id: ORGS_SHEET_ID });
    const orgRow = sheet.rows.find(row => row.id == orgId);
    if (!orgRow) throw new Error('Organization not found.');
    
    const allowsInBasketColId = sheet.columns.find(c => c.title === 'AllowsInBasket').id;
    return {
        allowsInBasket: orgRow.cells.find(c => c.columnId === allowsInBasketColId)?.value || false
    };
}

// Utility to convert a Smartsheet row into(row => row.id == orgId);
    if (!orgRow) throw new Error('Organization not found.');
    
    const allowsInBasketColId = sheet.columns.find(c => c.title === 'AllowsInBasket').id;
    return {
        allowsInBasket: orgRow.cells.find(c => c.columnId === allowsInBasketColId)?.value || false
    };
}

// Utility to convert a Smartsheet row into a simple key-value object
function formatRowToObject(row, columns) {
    const obj = {};
    columns a simple key-value object
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
