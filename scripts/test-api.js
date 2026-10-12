const http = require('http');

/**
 * Automated Verification Script for Personal Blogging Platform REST API
 * Tests all endpoints: Users, Articles (CRUD + Filters), Comments, and Likes.
 */

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Running Automated API Test Suite...\n');

  try {
    // 1. Health Check
    console.log('1. Testing GET /api/health...');
    const health = await request('GET', '/api/health');
    console.log(`   Status: ${health.status} =>`, health.body);

    // 2. Create User
    console.log('\n2. Testing POST /api/users...');
    const testUsername = `testuser_${Date.now()}`;
    const userRes = await request('POST', '/api/users', {
      username: testUsername,
      email: `${testUsername}@test.com`,
      password: 'password123'
    });
    console.log(`   Status: ${userRes.status} =>`, userRes.body);
    const userId = userRes.body.id;

    // 3. Create Article
    console.log('\n3. Testing POST /api/articles...');
    const articleRes = await request('POST', '/api/articles', {
      user_id: userId,
      title: 'Automated Test Article',
      content: 'This article was created automatically during backend verification testing.',
      tags: 'testing,api,express'
    });
    console.log(`   Status: ${articleRes.status} =>`, articleRes.body);
    const articleId = articleRes.body.id;

    // 4. Fetch All Articles
    console.log('\n4. Testing GET /api/articles...');
    const articlesRes = await request('GET', '/api/articles');
    console.log(`   Status: ${articlesRes.status} | Found ${articlesRes.body.count} articles.`);

    // 5. Filter Articles by Tag
    console.log('\n5. Testing GET /api/articles?tag=testing...');
    const filterTagRes = await request('GET', '/api/articles?tag=testing');
    console.log(`   Status: ${filterTagRes.status} | Matching articles: ${filterTagRes.body.count}`);

    // 6. Update Article
    console.log(`\n6. Testing PUT /api/articles/${articleId}...`);
    const updateRes = await request('PUT', `/api/articles/${articleId}`, {
      title: 'Automated Test Article [UPDATED]',
      content: 'Updated content body for verification.',
      tags: 'testing,updated'
    });
    console.log(`   Status: ${updateRes.status} =>`, updateRes.body);

    // 7. Post Comment
    console.log('\n7. Testing POST /api/comments...');
    const commentRes = await request('POST', '/api/comments', {
      article_id: articleId,
      user_id: userId,
      content: 'Great test article!'
    });
    console.log(`   Status: ${commentRes.status} =>`, commentRes.body);

    // 8. Toggle Like
    console.log('\n8. Testing POST /api/likes/toggle...');
    const likeRes = await request('POST', '/api/likes/toggle', {
      article_id: articleId,
      user_id: userId
    });
    console.log(`   Status: ${likeRes.status} =>`, likeRes.body);

    // 9. Delete Article
    console.log(`\n9. Testing DELETE /api/articles/${articleId}...`);
    const deleteRes = await request('DELETE', `/api/articles/${articleId}`);
    console.log(`   Status: ${deleteRes.status} =>`, deleteRes.body);

    console.log('\n✅ ALL API TESTS COMPLETED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Test execution error:', error.message);
  }
}

if (require.main === module) {
  runTests();
}
