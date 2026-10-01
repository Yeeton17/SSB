const Groq = require("groq-sdk");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { text, mode } = JSON.parse(event.body);

    if (!text || text.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No study text provided or extracted." }),
      };
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    let prompt = "";
    if (mode === "flashcards") {
      prompt = `Extract core concepts from the following material and build flashcards. Return ONLY a valid JSON array of objects with "question" and "answer" properties. Do not wrap in markdown or triple backticks:\n\n${text}`;
    } else if (mode === "quiz") {
      prompt = `Generate a 3-question multiple-choice quiz based on this text. Return ONLY a valid JSON array of objects with "question", "options" (array of 4 strings), and "answer" (string matching the correct option). Do not wrap in markdown or triple backticks:\n\n${text}`;
    } else {
      prompt = `Provide a clear, well-structured summary with key bullet points for the following study material:\n\n${text}`;
    }

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a smart academic study assistant. When asked for JSON, output ONLY valid raw JSON with no markdown wrapping or conversational commentary."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      // CHANGED: Using supported Groq model
      model: "llama-3.3-70b-versatile",
      temperature: 0.3
    });

    const resultText = completion.choices[0]?.message?.content || "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: resultText }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Groq API execution failed." }),
    };
  }
};