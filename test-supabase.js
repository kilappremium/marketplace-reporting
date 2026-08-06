import 'dotenv/config'
import supabaseAdmin from './lib/supabase-admin.js'

const test = async () => {

  const { data, error } = await supabaseAdmin
    .from('shopee_connections')
    .select('*')

  console.log('DATA:', data)
  console.log('ERROR:', error)

}

test()
