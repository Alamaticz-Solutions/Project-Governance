// api_test.js - Automated test script to verify backend API endpoints
const http = require('http');

const API_URL = 'http://localhost:8000/api/v1';
let token = '';
let createdProjectId = '';

const testAuthLogin = async () => {
    console.log('\n[1] Testing Auth Login (POST /auth/login)...');
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@abchealth.com', password: 'Demo1234!' })
        });
        const data = await res.json();
        if (res.ok && data.access_token) {
            token = data.access_token;
            console.log('✅ Auth Login Successful. Token received.');
        } else {
            console.error('❌ Auth Login Failed:', data);
        }
    } catch (err) {
        console.error('❌ Error during login:', err.message);
    }
};

const testAuthMe = async () => {
    console.log('\n[2] Testing Auth Me (GET /auth/me)...');
    try {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.email === 'admin@abchealth.com') {
            console.log('✅ Auth Me Successful:', data.full_name);
        } else {
            console.error('❌ Auth Me Failed:', data);
        }
    } catch (err) {
        console.error('❌ Error during /auth/me:', err.message);
    }
};

const testDashboard = async () => {
    console.log('\n[3] Testing Dashboard Data (GET /dashboard/)...');
    try {
        const res = await fetch(`${API_URL}/dashboard/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.kpis) {
            console.log('✅ Dashboard Load Successful. KPIs retrieved.');
        } else {
            console.error('❌ Dashboard Load Failed:', data);
        }
    } catch (err) {
        console.error('❌ Error during dashboard fetch:', err.message);
    }
};

const testProjectList = async () => {
    console.log('\n[4] Testing Project List (GET /projects)...');
    try {
        const res = await fetch(`${API_URL}/projects`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            console.log(`✅ Project List Successful. Found ${data.length} projects.`);
        } else {
            console.error('❌ Project List Failed:', data);
        }
    } catch (err) {
        console.error('❌ Error during project list fetch:', err.message);
    }
};

const runAllTests = async () => {
    console.log('🚀 Starting API Integration Tests...');
    
    await testAuthLogin();
    if (!token) {
        console.error('Stopping tests because authentication failed.');
        return;
    }
    
    await testAuthMe();
    await testDashboard();
    await testProjectList();
    
    console.log('\n🎉 All core API tests completed.');
};

runAllTests();
