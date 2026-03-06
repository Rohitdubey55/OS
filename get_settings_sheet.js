const fs = require('fs');
const https = require('https');

https.get("https://script.google.com/macros/s/AKfycbwYyYc-53fBvH-O_I_FhI4Oa2g-nJ3O3eHbH7oK9eC1W8I3XvH7A-3s5lH3XwI0Xk0/exec?action=get&sheet=settings", (res) => {
    let data = '';
    
    // Follow redirect if 302
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, (redirectRes) => {
            redirectRes.on('data', chunk => data += chunk);
            redirectRes.on('end', () => console.log(JSON.parse(data)));
        });
        return;
    }
    
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(JSON.parse(data)));
});
