// test-login.js
const axios = require('axios');

async function testLogin() {
  try {
    console.log('Testing login with demo credentials...');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'demo@example.com',
      password: 'password123'
    });
    
    console.log('✓ SUCCESS:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('✗ ERROR:', error.response ? error.response.data : error.message);
  }
}

testLogin();