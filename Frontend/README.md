<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/af2aa6dd-c4ea-4ef6-a005-63c7e2f4b9b7

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. For the local OpenCV workflow, create `.env.local` with:
   `VITE_API_BASE_URL=http://127.0.0.1:8000`
3. Start the backend in a separate terminal from `Backend`:
   ` $env:PYTHONPATH="$PWD\src"; .\.venv\Scripts\python.exe -m uvicorn auditvision.api.app:app --host 127.0.0.1 --port 8000`
4. Run the app from `Frontend`:
   `npm.cmd run dev`

The Upload screen first uploads a PDF, then allows a selection of at most five
1-based PDF page indexes for the synchronous local OpenCV endpoint. Review actions
remain local UI state until a review-persistence API is introduced.
