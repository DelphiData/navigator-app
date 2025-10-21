// IMPORTANT: This code runs on a server, not in the browser.

const smartsheet = require('smartsheet');
const OpenAI = require('openai');

const smartsheetClient = smartsheet.createClient({
    accessToken: process.env.SMARTSHEET_ACCESS_TOKEN
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

//Of course. Here is the complete, clean, and correct code for the `api.js` file.

Please copy this entire block and paste it into your `netlify/functions/api.js` file on GitHub, replacing all the existing content.

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
const ORGS_SHEET_ID = process.env.SM --- CONFIGURATION FOR YOUR SMARTSHEET ---
const ORGS_SHEET_ID = process.env.SMARTSHEET_ORGS_SHEET_ID;
const RULES_SHEET_ID = process.env.SMARTSARTSHEET_ORGS_SHEET_ID;
const RULES_SHEET_ID = process.env.SMARTSHEET_RULES_SHEET_ID;
const TEMPLATES_SHEET_ID = process.env.SMHEET_RULES_SHEET_ID;
const TEMPLATES_SHEET_ID = process.env.SMARTSHEET_TEMPLATES_SHEET_ID;

// --- CORS HEADERS ---
// This is the crucialARTSHEET_TEMPLATES_SHEET_ID;

// --- CORS HEADERS ---
// This is the crucial part that gives your GitHub Pages site permission to access this function.
const headers = {
  'Access-Control part that gives your GitHub Pages site permission to access this function.
const headers = {
  'Access-Control-Allow-Origin': 'https://delphidata.github.io', // The URL of your frontend app
  '-Allow-Origin': 'https://delphidata.github.io', // The URL of your frontend app
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods':Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};


// The main function that Netlify will run
exports.handler = async (event 'POST, OPTIONS'
};


// The main function that Netlify will run
exports.handler = async (event) => {
    // Handle the browser's CORS preflight request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'CORS preflight check successful' })
        };
    }

    // Only allow POST requests for our actual logic
    if (event.httpMethod !== 'POST') {
        return { statusCode) => {
    // Handle the browser's CORS preflight request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'CORS preflight check successful' })
        };
    }

    // Only allow POST requests for our actual logic
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        : 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const { action, ...data } = JSON.parse(event.body);

        let responseBody;

        switchconst { action, ...data } = JSON.parse(event.body);

        let responseBody;

        switch (action) {
            case 'getOrgs':
                responseBody = await getOrganizations();
                break;
             (action) {
            case 'getOrgs':
                responseBody = await getOrganizations();
                break;
            
            case 'analyzeSnippet':
                responseBody = await analyzeSnippet(data);
                break;

            
            case 'analyzeSnippet':
                responseBody = await analyzeSnippet(data);
                break;

            default:
                return { statusCode: 400, headers, body: JSON.stringify({ message: 'default:
                return { statusCode: 400, headers, body: JSON.stringify({ message: 'Invalid action.' }) };
        }
        
        return { statusCode: 200, headers, body:Invalid action.' }) };
        }
        
        return { statusCode: 200, headers, body: JSON.stringify(responseBody) };

    } catch (error) {
        console.error("Error in server JSON.stringify(responseBody) };

    } catch (error) {
        console.error("Error in serverless function:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ message:less function:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ message: error.message }) };
    }
};

// --- HELPER FUNCTIONS ---

async function getOrganizations() {
    const error.message }) };
    }
};

// --- HELPER FUNCTIONS ---

async function getOrganizations() {
    const options = { id: ORGS_SHEET_ID };
    const sheet = await smartsheetClient.sheets.getSheet options = { id: ORGS_SHEET_ID };
    const sheet = await smartsheetClient.sheets.getSheet(options);
    const orgs = sheet.rows.map(row => {
        const nameCell = row.cells.find(c => c.columnId === sheet.columns[0].id);
        return {
            id: row.id,
            name: nameCell ? nameCell.value : 'Unnamed Org'
        };
    });
    return orgs;
}

async function analyzeSnippet({ orgId, hasPCP, snippet(options);
    const orgs = sheet.rows.map(row => {
        const nameCell = row.cells.find(c => c.columnId === sheet.columns[0].id);
        return {
            id: row.id,
            name: nameCell ? nameCell.value : 'Unnamed Org'
        };
    });
    return orgs;
}

async function analyzeSnippet({ orgId, hasPCP, snippet }) {
    const [allRules, orgDetails] = await Promise.all([
        smartsheetClient.sheets.getSheet({ id: RULES_SHEET_ID }),
        getOrgDetails(orgId)
    ]);

     }) {
    const [allRules, orgDetails] = await Promise.all([
        smartsheetClient.sheets.getSheet({ id: RULES_SHEET_ID }),
        getOrgDetails(orgId)
    ]);

    const matchedRuleId = await classifySnippetWithOpenAI(snippet, allRules);
    if (!matchedRuleId) {
const matchedRuleId = await classifySnippetWithOpenAI(snippet, allRules);
    if (!matchedRuleId) {
        throw new Error('OpenAI could not confidently match the snippet to a known rule.');
    }

    const matchedRuleRow        throw new Error('OpenAI could not confidently match the snippet to a known rule.');
    }

    const matchedRuleRow = allRules.rows.find(row => {
        const ruleIdCell = row.cells.find(c => c.columnId === allRules.columns[0].id);
        return String(ruleIdCell?.value) === String(matchedRuleId);
    });

    if (!matchedRuleRow) {
        throw new Error(`Matched rule ID ${matchedRuleId} not found in Smartsheet.`);
    }
    
    const matchedRule = = allRules.rows.find(row => {
        const ruleIdCell = row.cells.find(c => c.columnId === allRules.columns[0].id);
        return String(ruleIdCell?.value) === String(matchedRuleId);
    });

    if (!matchedRuleRow) {
        throw new Error(`Matched rule ID ${matchedRuleId} not found in Smartsheet.`);
    }
    
    const matchedRule = formatRowToObject(matchedRuleRow, allRules.columns);
    const actionPlan = matchedRule.Recommendation;
     formatRowToObject(matchedRuleRow, allRules.columns);
    const actionPlan = matchedRule.Recommendation;
    const communication = await selectCommunicationTemplate({
        orgDetails,
        hasPCP,
        severity: matchedRuleconst communication = await selectCommunicationTemplate({
        orgDetails,
        hasPCP,
        severity: matchedRule.Severity
    });

    return {
        matchedRule,
        actionPlan,
        communication
    };
.Severity
    });

    return {
        matchedRule,
        actionPlan,
        communication
    };
}

async function classifySnippetWithOpenAI(snippet, rulesSheet) {
    const ruleChoices = rulesSheet.rows.}

async function classifySnippetWithOpenAI(snippet, rulesSheet) {
    const ruleChoices = rulesSheet.rows.map(row => {
        const id = row.cells.find(c => c.columnId === rulesSheet.columns[0].id)?.value;
        const condition = row.cells.find(c => c.columnId === rulesSheet.columns[3].id)?.value;
        return `${id}: ${condition}`;
    });
    
    try {
        const completion = await openai.chat.completions.create({
map(row => {
        const id = row.cells.find(c => c.columnId === rulesSheet.columns[0].id)?.value;
        const condition = row.cells.find(c => c.columnId === rulesSheet.columns[3].id)?.value;
        return `${id}: ${condition}`;
    });
    
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: "You are an expert system for a healthcare navigator. Your task is to analyze a snippet from a radiology report and strictly match it to ONE of the provided rule IDs based on its description. Respond ONLY with the matching RuleID in the specified JSON format."
                },
                {
                    role: "user",
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
            response_format: { type: "json_object" }
        });
        const result = JSON.parse(completion.choices[0].message.content);
        return result.matched                    content: `Here is the report snippet:\n\n"${snippet}"\n\nHere are the possible rules:\n\n${ruleChoices.join('\n')}\n\nWhich rule ID best matches the snippet?`
                }
            ],
            response_format: { type: "json_object" }
        });
        const result = JSON.parse(completion.choices[0].message.content);
        return result.matchedRuleId;
    } catch (error) {
        console.error("OpenAI API call failed:", errorRuleId;
    } catch (error) {
        console.error("OpenAI API call failed:", error);
        throw new Error("Failed to get a classification from the AI model.");
    }
}

async function selectCommunication);
        throw new Error("Failed to get a classification from the AI model.");
    }
}

async function selectCommunicationTemplate({ orgDetails, hasPCP, severity }) {
    const templatesSheet = await smartsheetClient.sheets.Template({ orgDetails, hasPCP, severity }) {
    const templatesSheet = await smartsheetClient.sheets.getSheet({ id: TEMPLATES_SHEET_ID });
    const templates = templatesSheet.rows.map(getSheet({ id: TEMPLATES_SHEET_ID });
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
    }row => formatRowToObject(row, templatesSheet.columns));

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

async function getOrgDetails(orgId) {
    const sheet = await smartsheetClient.sheets.}

async function getOrgDetails(orgId) {
    const sheet = await smartsheetClient.sheets.getSheet({ id: ORGS_SHEET_ID });
    const orgRow = sheet.rows.find(getSheet({ id: ORGS_SHEET_ID });
    const orgRow = sheet.rows.find(row => String(row.id) === String(orgId));
    if (!orgRow) throw new Error('Organization not found.');
    
    const allowsInBasketCol = sheet.columns.find(c => c.title === 'AllowsInBasket');
    if (!allowsInBasketCol) throw new Error('Column "AllowsInBasket" not found in Orgs sheet.');

    const allowsInBasketCell = orgRow.cells.find(c => c.columnIdrow => String(row.id) === String(orgId));
    if (!orgRow) throw new Error('Organization not found.');
    
    const allowsInBasketCol = sheet.columns.find(c => c.title === 'AllowsInBasket');
    if (!allowsInBasketCol) throw new Error('Column "AllowsInBasket" not found in Orgs sheet.');

    const allowsInBasketCell = orgRow.cells.find(c => c.columnId === allowsInBasketCol.id);
    return {
        allowsInBasket: allowsInBasketCell ? allows === allowsInBasketCol.id);
    return {
        allowsInBasket: allowsInBasketCell ? allowsInBasketCell.value : false
    };
}

function formatRowToObject(row, columns) {
    constInBasketCell.value : false
    };
}

function formatRowToObject(row, columns) {
    const obj = {};
    columns.forEach(column => {
        const cell = row.cells.find(c => c.columnId === column.id);
        // Sanitize the column title to be a valid Javascript key
        const key = column.title.replace(/\s+/g, '');
        if (cell && cell.value !== undefined) {
            obj[key] = cell.value;
        }
    });
    return obj;
}
``` obj = {};
    columns.forEach(column => {
        const cell = row.cells.find(c => c.columnId === column.id);
        // Sanitize the column title to be a valid Javascript key
        const key = column.title.replace(/\s+/g, '');
        if (cell && cell.value !== undefined) {
            obj[key] = cell.value;
        }
    });
    return obj;
}
