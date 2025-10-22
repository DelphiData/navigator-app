// --- DIAGNOSTIC CODE ONLY ---
// This function's only purpose is to check if environment variables are being loaded correctly.

exports.handler = async (event) => {
    
    // Standard CORS headers
    const headers = {
      'Access-Control-Allow-Origin': 'https://delphidata.github.io',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle the preflight request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Prepare a report on the variables we found
    const report = {
        SMARTSHEET_ACCESS_TOKEN_FOUND: !!process.env.SMARTSHEET_ACCESS_TOKEN,
        OPENAI_API_KEY_FOUND: !!process.env.OPENAI_API_KEY,
        SMARTSHEET_ORGS_SHEET_ID_FOUND: !!process.env.SMARTSHEET_ORGS_SHEET_ID,
        SMARTSHEET_RULES_SHEET_ID_FOUND: !!process.env.SMARTSHEET_RULES_SHEET_ID,
        SMARTSHEET_TEMPLATES_SHEET_ID_FOUND: !!process.env.SMARTSHEET_TEMPLATES_SHEET_ID
    };

    // Send the report back to the browser
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(report)
    };
};
