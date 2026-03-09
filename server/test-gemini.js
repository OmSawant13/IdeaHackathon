const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testModel(modelName) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const res = await model.generateContent("hello");
    console.log(modelName, "SUCCESS:", res.response.text());
  } catch (e) {
    console.log(modelName, "FAILED:", e.message.substring(0, 100));
  }
}

async function run() {
  await testModel("gemini-1.5-flash");
  await testModel("gemini-2.0-flash-lite-preview-02-05");
  await testModel("gemini-2.0-flash");
  await testModel("gemini-1.5-pro");
}
run();
