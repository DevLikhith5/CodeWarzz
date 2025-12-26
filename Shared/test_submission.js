const http = require('http');

// Helper for making requests
function request(method, path, body, token = null) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : '';
        const options = {
            hostname: 'localhost',
            port: 3000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
                } catch (e) {
                    // console.log("Response Body (Raw):", responseBody);
                    resolve({ status: res.statusCode, body: responseBody });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function run() {
    const email = `test${Date.now()}@example.com`;
    const password = "password123";
    const username = `user${Date.now()}`;

    console.log(`1. Registering user: ${email}...`);
    const registerRes = await request('POST', '/api/v1/auth/signup', { email, password, username });
    console.log(`   Status: ${registerRes.status}`, JSON.stringify(registerRes.body));

    if (registerRes.status !== 201 && registerRes.status !== 200) return;

    console.log(`2. Logging in...`);
    const loginRes = await request('POST', '/api/v1/auth/signin', { email, password });
    console.log(`   Status: ${loginRes.status}`);

    const token = loginRes.body.data?.accessToken;
    if (!token) {
        console.error("   No token found!", loginRes.body);
        return;
    }
    console.log("   Got Token:", token.substring(0, 20) + "...");

    console.log(`3. Submitting solution...`);
    const submissionRes = await request('POST', '/api/v1/submissions', {
        contestId: "4e57b13e-75d4-4688-9fd4-921998165610",
        problemId: "53700bcd-24cc-404a-b67d-9b2022b136a8",
        language: "cpp",
        code: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() { return 0; }"
    }, token);

    console.log(`   Status: ${submissionRes.status}`);
    console.log(`   Body:`, JSON.stringify(submissionRes.body, null, 2));
}

run().catch(console.error);
