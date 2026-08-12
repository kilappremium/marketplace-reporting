import { sync as shopeeSync } from '@/lib/marketplace/providers/shopee'

import {
  createSyncLog,
  finishSyncLog,
  failSyncLog
} from '@/lib/sync/logger'

export async function GET(){

  const logs = []

  try {

    const result = await shopeeSync({})

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

  } catch(error){

    console.error(
      'CRON MARKETPLACE SYNC ERROR:',
      error
    )

    return Response.json({

      success: false,

      error: error.message

    },{
      status: 500
    })

  }

}
