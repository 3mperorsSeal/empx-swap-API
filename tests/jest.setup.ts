// Ensure Redis is disabled during tests to avoid external dependencies
process.env.REDIS_URL = "";
// Provide a test API key for protected endpoints
process.env.TEST_KEY = "TEST_KEY";
