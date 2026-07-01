const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'qwen/qwen3-32b',
]

export async function POST(request) {
  try {
    const { prompt } = await request.json()
    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      return Response.json({ error: 'GROQ_API_KEY tidak ditemukan' }, { status: 500 })
    }

    if (!prompt) {
      return Response.json({ error: 'Prompt tidak boleh kosong' }, { status: 400 })
    }

    let lastError = ''

    // Coba tiap model secara berurutan — kalau rate limit, lanjut ke model berikutnya
    for (const model of GROQ_MODELS) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1000,
            temperature: 0.7,
          }),
        })

        const data = await response.json()

        // Kalau sukses → langsung return
        if (response.ok && !data.error) {
          const text = data.choices?.[0]?.message?.content || ''
          return Response.json({ text, model_used: model })
        }

        // Kalau rate limit / model tidak tersedia → coba model berikutnya
        if (
          data.error?.code === 'rate_limit_exceeded' ||
          data.error?.code === 'model_decommissioned' ||
          data.error?.code === 'model_not_found' ||
          response.status === 429
        ) {
          console.warn(`[AI] Model ${model} tidak tersedia (${data.error?.code}), mencoba model berikutnya...`)
          lastError = `${model}: ${data.error?.message || 'tidak tersedia'}`
          continue
        }

        // Error lain (bukan rate limit) → langsung return error
        lastError = data.error?.message || 'Unknown error'
        return Response.json({
          error: lastError,
          full_response: data,
          status_code: response.status,
        }, { status: 400 })

      } catch (fetchErr) {
        console.error(`[AI] Fetch error untuk model ${model}:`, fetchErr.message)
        lastError = fetchErr.message
        continue
      }
    }

    // Semua model kena rate limit
    return Response.json({
      error: `Semua model AI sedang sibuk (rate limit). Coba lagi dalam beberapa menit. Detail: ${lastError}`,
    }, { status: 429 })

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
