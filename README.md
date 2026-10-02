# Smart Study Buddy

Smart Study Buddy turns pasted class notes or DOCX/PPTX files into a study guide, interactive flashcards, or a scored multiple-choice quiz. Generated sets are saved in the browser's local storage.

## Run locally

1. Install Node.js.
2. In the project folder, run `npm run dev` and open the local URL printed by Netlify.
3. Add your Hugging Face access token to a local `.env` file:

```text
HF_TOKEN=hf_your_token_here
```

The default model is `Qwen/Qwen2.5-7B-Instruct`. To use another model available through Hugging Face Inference Providers, add `HF_MODEL=provider/model-name` to `.env`.

## Deploy to Netlify

1. Push this project to a Git provider and import it in Netlify.
2. In **Site configuration → Environment variables**, add `HF_TOKEN` with a Hugging Face token that has permission to make Inference Providers calls.
3. Optionally add `HF_MODEL` if you want a different provider-supported chat model.
4. Deploy. The site publishes from the project root, and the generation endpoint is deployed from `netlify/functions`.

The Hugging Face token is read only by the Netlify function. Do not put it in client-side JavaScript or commit it to Git. Uploaded documents are parsed in the browser; only extracted text is sent to the function. The app accepts DOCX and PPTX files up to 12 MB and limits generated source text to 30,000 characters.

