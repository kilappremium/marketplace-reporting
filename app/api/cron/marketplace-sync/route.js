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


    log = await createSyncLog(
      result.connection_id
    )


    await finishSyncLog(
      log.id,
      result
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
