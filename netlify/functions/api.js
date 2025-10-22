const smartsheet = require('smartsheet');
const OpenAI = require('openai');

const smartsheetClient = smartsheet.createClient({
    accessToken: process.env.SMARTSHEET_ACCESS_TOKEN
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const ORGS_SHEET_ID = process.env.SMARTSHEET_ORGS_SHEET_ID;
const RULES_SHEET_ID = process.env.SMARTSHEET_RULES_SHEET_ID;
const TEMPLATES_SHEET_ID = process.env.SMARTSHEET_TEMPLATES_SHEET_ID;

const headers = {
  'Access-Control-Allow-Origin': 'https://delphidata.github.io',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
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
        console.error("Error in function:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ message: error.message }) };
    }
};

async function getOrganizations() {
    const sheet = await smartsheetClient.sheets.getSheet({ id: ORGS_SHEET_ID });
    return sheet.rows.map(row => ({
        id: row.id,
        name: row.cells[0] ? row.cells[0].value : 'Unnamed Org'
    }));
}

async function analyzeSnippet({ orgId, hasPCP, snippet }) {
    const allRules = await smartsheetClient.sheets.getSheet({ id: RULES_SHEET_ID });
    const matchedRuleId = await classifySnippetWithOpenAI(snippet, allRules);
    if (!matchedRuleId) {
        throw new Error('OpenAI could not confidently match the snippet to a known rule.');
    }
    const matchedRuleRow = allRules.rows.find(r => String(r.cells[0]?.value) === String(matchedRuleId));
    if (!matchedRuleRow) {
        throw new Error(`AI returned rule ID ${matchedRuleId}, but it was not found.`);
    }
    const matchedRule = formatRowToObject(matchedRuleRow, allRules.columns);
    const orgDetails = await getOrgDetails(orgId);
    const communication = await selectCommunicationTemplate({ orgDetails, hasPCP });
    return { matchedRule, actionPlan: matchedRule.Recommendation, communication };
}

async function classifySnippetWithOpenAI(snippet, rulesSheet) {
    const ruleChoices = rulesSheet.rows.map(row => {
        const id = row.cells[0]?.value;
        const condition = row.cells[3]?.value;
        return `${id}: ${condition}`;
    });
    const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        temperature: 0,
        messages: [{
            role: "system",
            content: "You are an expert clinical reasoner... (Your full prompt)"
        }, {
            role: "user",
            content: `Snippet: "${snippet}"\n\nRules:\n${ruleChoices.join('\n')}`
        }],
        response_format: { type: "json_object" }
    });
    const result = JSON.parse(completion.choices[0].message.content);
    return result.matchedRuleId || null;
}

// ... include the rest of the helper functions (selectCommunicationTemplate, getOrgDetails, formatRowToObject) from our previous successful version
async function selectCommunicationTemplate({ orgDetails, hasPCP }) {
    const templatesSheet = await smartsheetClient.sheets.getSheet({ id: TEMPLATES_SHEET_ID });
    const templates = templatesSheet.rows.map(row => formatRowToObject(row, templatesSheet.columns));
    let channel, recipient;
    if (orgDetails.allowsInBasket && hasPCP) {
        channel = 'In-Basket'; recipient = 'PCP';
    } else {
        channel = 'Fax'; recipient = hasPCP ? 'PCP' : 'Ordering Provider';
    }
    let chosenTemplate = templates.find(t => t.Channel === channel && t.Recipient === recipient) || templates.find(t => t.Channel === 'Fax') || templates[0];
    return { templateName: chosenTemplate.TemplateName, channel: chosenTemplate.Channel, body: chosenTemplate.Body };
}

async function getOrgDetails(orgId) {
    const sheet = await smartsheetClient.sheets.getSheet({ id: ORGS_SHEET_ID });
    const orgRow = sheet.rows.find(row => String(row.id) === String(orgId));
    if (!orgRow) throw new Error('Organization not found.');
    const col = sheet.columns.find(c => c.title === 'AllowsInBasket');
    const cell = orgRow.cells.find(c => c.columnId === col.id);
    return { allowsInBasket: cell ? cell.value : false };
}

function formatRowToObject(row, columns) {
    const obj = {};
    columns.forEach(col => {
        const cell = row.cells.find(c => c.columnId === col.id);
        if (cell && cell.value !== undefined) obj[col.title.replace(/\s+/g, '')] = cell.value;
    });
    return obj;
}
