# Backend configuration

## Environment variables

The backend expects the following variables when enabling the equipment-driven portrait workflow:

- `OPENAI_API_KEY`: API key used to call OpenAI's image edit endpoint for portrait rendering.
- `REDIS_URL`: Connection string consumed by BullMQ/ioredis to enqueue equipment portrait refresh jobs.
- `PORTRAIT_BASE_PROMPT`: Optional base description prepended to every render prompt before item prompts are appended.

Configure these variables together with the existing database and Cloudinary settings in your environment (e.g. `.env`).
