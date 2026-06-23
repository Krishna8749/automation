import https from 'https';

const postData = JSON.stringify({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'Say hello in exactly 3 words.' }
  ],
  stream: false
});

const options = {
  hostname: 'automation-xwbh.onrender.com',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer Ramamtech',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('📡 Sending request to Render Gateway API: https://automation-xwbh.onrender.com/v1/chat/completions');

const req = https.request(options, (res) => {
  console.log(`📥 Status: ${res.statusCode} ${res.statusMessage}`);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('\n🤖 [Response Content]:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch {
      console.log(data);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request Error:', err.message);
});

req.write(postData);
req.end();
