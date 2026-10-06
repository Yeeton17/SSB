# Smart Study Buddy

Smart Study Buddy turns pasted class notes or DOCX/PPTX files into a study guide, interactive flashcards, or a scored multiple-choice quiz. Generated sets are saved in the browser's local storage.

## Run locally

1. Install Node.js 20.6 or newer.
2. Set `HF_TOKEN` in the root `.env` file. A template is available in `.env.example`.
3. In the project folder, run `npm start` and open <http://127.0.0.1:3000>.

The Node server serves the app and its generation endpoint. For Netlify's local emulation instead, run `npm run dev`.

To use a different model available through Hugging Face Inference Providers, set `HF_MODEL=provider/model-name` in `.env`. `HOST` and `PORT` can also be configured there.

## Deploy to Netlify

1. Push this project to a Git provider and import it in Netlify.
2. In **Site configuration → Environment variables**, add `HF_TOKEN` with a Hugging Face token that has permission to make Inference Providers calls.
3. Optionally add `HF_MODEL` if you want a different provider-supported chat model.
4. Deploy. The site publishes from the project root, and the generation endpoint is deployed from `netlify/functions`.

The Hugging Face token is read only by the Netlify function. Do not put it in client-side JavaScript or commit it to Git. Uploaded documents are parsed in the browser; only extracted text is sent to the function. The app accepts DOCX and PPTX files up to 12 MB and limits generated source text to 30,000 characters.