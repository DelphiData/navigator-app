// A simplified function for debugging purposes ONLY.
exports.handler = async (event) => {

    // Define the CORS headers that allow your GitHub Pages site to make requests.
    const headers = {
        'Access-Control-Allow-Origin': 'https://delphidata.github.io',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // The browser sends a "preflight" OPTIONS request first. We must respond to it successfully.
    if (event.httpMethod === 'OPTIONS```javascript
// A simplified function for debugging purposes ONLY.
exports.handler = async (event) => {

    // Define the CORS headers that allow your GitHub Pages site to make requests.
    const headers = {
        'Access-Control-Allow-Origin': 'https://delphidata.github.io',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // The browser sends a "preflight" OPTIONS request first. We must respond to it successfully.
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // 204 No Content is the') {
        return {
            statusCode: 204, // 204 No Content is the standard for a successful preflight.
            headers,
            body: ''
        };
    }

    // This standard for a successful preflight.
            headers,
            body: ''
        };
    }

    // This handles the actual POST request from your application.
    if (event.httpMethod === 'POST') {
        // handles the actual POST request from your application.
    if (event.httpMethod === 'POST') {
        // For this test, we will just send back a fake organization list.
        const testData = [{ id: '123', name: 'Test Organization: Connection Successful!' }];
        
        return {
            statusCode: 200, For this test, we will just send back a fake organization list.
        const testData = [{ id: '123', name: 'Test Organization: Connection Successful!' }];
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(testData)
        };
    }

    //
            headers,
            body: JSON.stringify(testData)
        };
    }

    // If the request is not POST or OPTIONS, deny it.
    return {
        statusCode: 405,
 If the request is not POST or OPTIONS, deny it.
    return {
        statusCode: 405,
        headers,
        body: 'Method Not Allowed'
    };
};
        headers,
        body: 'Method Not Allowed'
    };
};
