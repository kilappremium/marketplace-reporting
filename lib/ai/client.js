/**
 * Existing Groq AI client used by /api/ai-analysis.
 * Do not introduce a separate AI provider — reuse this everywhere.
 */

export const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'qwen/qwen3-32b',
]

/**
 * @param {string} prompt
 * @param {{ max_tokens?: number, temperature?: number, systemPrompt?: string }} [options]
 * @returns {Promise<{ text: string, model_used: string }>}
 */
export async function generateAiText(prompt, options = {}) {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    throw new Error('GROQ_API_KEY tidak ditemukan')
  }
  if (!prompt) {
    throw new Error('Prompt tidak boleh kosong')
  }

  const max_tokens = options.max_tokens ?? 1000
  const temperature = options.temperature ?? 0.7
  const messages = []

  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  let lastError = ''

  for (const model of GROQ_MODELS) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens,
          temperature,
        }),
      })

      const data = await response.json()

      if (response.ok && !data.error) {
        return {
          text: data.choices?.[0]?.message?.content || '',
          model_used: model,
        }
      }

      if (
        data.error?.code === 'rate_limit_exceeded' ||
        data.error?.code === 'model_decommissioned' ||
        data.error?.code === 'model_not_found' ||
        response.status === 429
      ) {
        console.warn(
          `[AI] Model ${model} tidak tersedia (${data.error?.code}), mencoba model berikutnya...`
        )
        lastError = `${model}: ${data.error?.message || 'tidak tersedia'}`
        continue
      }

      throw Object.assign(
        new Error(data.error?.message || 'Unknown AI error'),
        { status: 400, full_response: data }
      )
    } catch (err) {
      if (err.status === 400) throw err
      console.error(`[AI] Fetch error untuk model ${model}:`, err.message)
      lastError = err.message
      continue
    }
  }

  throw Object.assign(
    new Error(
      `Semua model AI sedang sibuk (rate limit). Coba lagi dalam beberapa menit. Detail: ${lastError}`
    ),
    { status: 429 }
  )
}
