# Notely

Turn your own notes into short, interactive multiple-choice quizzes. Built with React/Vite and a small Express API for RootsSys. No database or accounts.

## Privacy model

PDF, DOCX, TXT and MD files are parsed in the browser. The original files are never uploaded or saved on the server. When you generate a quiz, the extracted text is sent to your VPS API and then to RootsSys to produce the questions. Notes, answers, the notes-chat conversation and quiz history live in browser memory for this tab only, and are cleared on refresh or when you choose **Clear notes and start fresh**. The server does not persist them. Avoid uploading sensitive notes unless you are comfortable with the API provider processing their text.

Text-based PDFs work. Image-only scans need OCR before upload. Per-file limit: 15 MB; up to 12 files and 100,000 extracted characters per request.

## Run the buildless local app (no npm install)

Run `node preview-server.mjs` in this folder, then open http://127.0.0.1:4173. The server reads the RootsSys key from `ROOTSYS_API_KEY` or a local key file under the current user's Temp/Notely folder. The key is never sent to the browser. Paste notes, or select TXT/MD/PDF/DOCX files. PDF and DOCX readers load from jsDelivr in the browser, so those file types need an internet connection. The original files remain on the device; extracted text is sent to RootsSys for quiz generation. Restart the server after editing its code.
## Local development

1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `ROOTSYS_API_KEY`.
4. Start the API with `node --env-file=.env server/index.js`.
5. In another terminal run `npm run dev` and visit the URL Vite prints (usually http://localhost:5173).

The Vite dev server proxies `/api` to port 3001.

## VPS deployment (Docker)

Build the container with `docker build -t notely .`, then run it with:

```sh
docker run -d --name notely --restart unless-stopped \
  --env-file .env -p 127.0.0.1:3001:3001 notely
```

Point Nginx at `http://127.0.0.1:3001`, enable HTTPS, and keep your `.env` outside the image and Git. The same Express process serves the built frontend and `/api/quiz`. Only the VPS knows the API key.

Sample Nginx location inside your HTTPS server block:

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

For public use, add a reverse-proxy request limit or authentication to control LLM spending. The API accepts up to 15 questions per request and 100,000 characters of notes but does not include per-user rate limiting.

## Question-aware study bot

During a quiz, the floating **Ask Notely** bot receives the current question, answer options, whether the learner has answered, and a short excerpt around the relevant note. Its chat resets on the next question. While the provider works, the bot cycles through short thinking messages and then reveals the reply with a quick typing effect; reduced-motion settings show the completed reply at once. Before an answer is submitted it offers hints without giving away the choice; afterward it can explain the correct answer. Each chat message makes a separate RootsSys API request, so public deployments should add rate limits or authentication to manage cost.
## How quizzes work

**My notes only** asks for questions grounded in the supplied text. A returned question needs a matching source file and verbatim excerpt, or it is discarded. This checks attribution, though it cannot guarantee every inference is correct. **Explore more** also permits general knowledge questions and labels those as beyond the notes. The app shows immediate feedback with reasons for the correct option and the selected wrong option, a round summary, and supports another round while passing recent question text to avoid close repeats.





