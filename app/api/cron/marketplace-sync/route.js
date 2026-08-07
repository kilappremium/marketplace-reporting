import { sync as shopeeSync } from '@/lib/marketplace/providers/shopee'

import {
  createSyncLog,
  finishSyncLog,
  failSyncLog
} from '@/lib/sync/logger'

export async function GET(){

  let log = null


  try {

    const result =
      await shopeeSync({})


    const connectionId =
      result.results?.[0]?.connection_id


    log = await createSyncLog(
      connectionId
    )


    await finishSyncLog(
      log.id,
      result.results?.[0] || {}
    )


    return Response.json({

      success:true,

      result

    })


  } catch(error){


    console.error(
      'CRON MARKETPLACE SYNC ERROR:',
      error
    )


    if(log){

      await failSyncLog(
        log.id,
        error
      )

    }


    return Response.json({

      success:false,

      error:error.message

    },{
      status:500
    })


  }

}
