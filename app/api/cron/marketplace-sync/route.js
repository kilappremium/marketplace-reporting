import { sync as shopeeSync } from '@/lib/marketplace/providers/shopee'

import {
  createSyncLog,
  finishSyncLog,
  failSyncLog
} from '@/lib/sync/logger'

export async function GET(request){

  const logs = []

  try {

    const { searchParams } = new URL(request.url)

    const dateStart = searchParams.get('dateStart')
    const dateEnd = searchParams.get('dateEnd')

    const result = await shopeeSync({
      dateStart: dateStart || undefined,
      dateEnd: dateEnd || undefined,
    })

    for (const syncResult of result.results || []) {

      const connectionId = syncResult.connection_id

      const log = await createSyncLog(connectionId)

      await finishSyncLog(
        log.id,
        syncResult
      )

      logs.push({
        connection_id: connectionId,
        log_id: log.id,
        status: 'success'
      })
    }

    return Response.json({

      success: true,

      result,

      logs

    })

  } catch (error) {

    console.error('CRON MARKETPLACE SYNC ERROR')
    console.error('NAME:', error?.name)
    console.error('MESSAGE:', error?.message)
    console.error('CAUSE:', error?.cause)
    console.error('STACK:', error?.stack)

    return Response.json({
      success: false,
      error: error?.message || 'Unknown error',
      name: error?.name || null,
      cause: error?.cause
        ? String(error.cause)
        : null,
    }, {
      status: 500
    })
  }

}
