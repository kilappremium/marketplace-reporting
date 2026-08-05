import { generateAiText, GROQ_MODELS } from 
'../../../lib/ai/client.js'

export async function POST(request) {
  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return Response.json({ error: 'Prompt tidak boleh kosong' }, { status: 400 })
    }

    try {
      const result = await generateAiText(prompt)
      return Response.json({ text: result.text, model_used: result.model_used })
    } catch (err) {
      const status = err.status || 500
      if (status === 400) {
        return Response.json({
          error: err.message,
          full_response: err.full_response,
          status_code: status,
        }, { status: 400 })
      }
      if (status === 429) {
        return Response.json({ error: err.message }, { status: 429 })
      }
      if (err.message === 'GROQ_API_KEY tidak ditemukan') {
        return Response.json({ error: err.message }, { status: 500 })
      }
      return Response.json({ error: err.message }, { status: status >= 400 ? status : 500 })
    }
  } catch (err) {
    console.error('[AI Analysis Error]', err)
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({
    status: 'API route aktif',
    groq_key_exists: !!process.env.GROQ_API_KEY,
    models_available: GROQ_MODELS,
  })
}
