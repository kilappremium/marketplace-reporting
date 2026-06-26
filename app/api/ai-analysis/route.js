export async function POST(request) {
    try {
      const { prompt } = await request.json()
      const apiKey = process.env.GEMINI_API_KEY
  
      if (!apiKey) {
        return Response.json({ error: 'GEMINI_API_KEY tidak ditemukan' }, { status: 500 })
      }
  
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
          }),
        }
      )
  
      const data = await response.json()
      
      // Return full response for debugging
      if (!response.ok || data.error) {
        return Response.json({ 
          error: data.error?.message || 'Unknown error',
          full_response: data,
          status_code: response.status
        }, { status: 400 })
      }
  
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      return Response.json({ text })
  
    } catch (err) {
      return Response.json({ error: 'Server error: ' + err.message }, { status: 500 })
    }
  }
  
  export async function GET() {
    return Response.json({
      status: 'API route aktif',
      gemini_key_exists: !!process.env.GEMINI_API_KEY
    })
  }