import { createClient } from '@supabase/supabase-js'


function getSupabaseAdmin(){

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

}


export async function createSyncLog(connectionId){

  const supabase = getSupabaseAdmin()


  const { data, error } = await supabase
    .from('sync_logs')
    .insert({
      connection_id: connectionId,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()


  if(error){
    throw error
  }


  return data

}



export async function finishSyncLog(
  id,
  result={}
){

  const supabase = getSupabaseAdmin()


  const { error } = await supabase
    .from('sync_logs')
    .update({
      status: 'success',
      finished_at: new Date().toISOString(),
      records_processed: result.total_orders ?? 0,
      message: `Inserted ${result.inserted_rows ?? 0}, Updated ${result.updated_rows ?? 0}`,
    })
    .eq('id',id)


  if(error){
    throw error
  }

}



export async function failSyncLog(
  id,
  error
){

  const supabase = getSupabaseAdmin()


  await supabase
    .from('sync_logs')
    .update({

      status:'failed',

      finished_at:new Date().toISOString(),

      message:
        error.message

    })
    .eq('id',id)

}