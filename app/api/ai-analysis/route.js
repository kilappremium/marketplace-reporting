export async function POST(request) {
  try {
    const { prompt } = await request.json()
    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      return Response.json({ error: 'GROQ_API_KEY tidak ditemukan' }, { status: 500 })
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      return Response.json({
        error: data.error?.message || 'Unknown error',
        full_response: data,
        status_code: response.status,
      }, { status: 400 })
    }

    const text = data.choices?.[0]?.message?.content || ''
    return Response.json({ text })

  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({
    status: 'API route aktif',
    groq_key_exists: !!process.env.GROQ_API_KEY,
  })
}